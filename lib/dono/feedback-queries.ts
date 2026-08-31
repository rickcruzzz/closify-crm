import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'
import { ANEXO_BUCKET } from '@/lib/storage/anexo-de-feedback'
import type { AnexoDeFeedback, StatusDeFeedback, TipoDeFeedback } from '@/types/supabase'

export type AnexoNaTela = AnexoDeFeedback & {
  /** URL assinada, validade curta. O bucket é privado e não tem URL fixa. */
  url: string | null
  ehImagem: boolean
}

export type RelatoNaTela = {
  id: string
  tipo: TipoDeFeedback
  status: StatusDeFeedback
  mensagem: string
  solucao: string | null
  rota: string | null
  plano: string | null
  userAgent: string | null
  criadoEm: string
  resolvidoEm: string | null
  /** Nome da empresa, resolvido aqui — a tabela guarda só o id. */
  empresa: string
  /**
   * Quem escreveu, com nome E e-mail.
   *
   * O nome vem de `user_metadata.name`, gravado no cadastro. Sem ele a fila
   * seria uma lista de endereços — e responder a "wixese9814@neplis.com" é
   * outra conversa que responder a "Marcos, da Consultoria Ribeiro".
   */
  pessoa: { nome: string; email: string }
  anexos: AnexoNaTela[]
  /**
   * Veio de conta do próprio dono ou de teste.
   *
   * Vai junto com o relato, e não só na contagem, porque a tela precisa
   * marcar visualmente cada linha quando estiver mostrando os internos — sem
   * o selo, um relato de teste no meio da fila é indistinguível de cliente
   * real, que é exatamente o defeito de 20/08 que a separação existe para
   * evitar.
   */
  interno: boolean
}

export type FilaDeFeedback = {
  relatos: RelatoNaTela[]
  /** Contagem por status, para os filtros mostrarem quanto há em cada. */
  contagem: Record<StatusDeFeedback, number> & { total: number; problemas: number }
  /**
   * Quantos relatos internos existem, dito à parte.
   *
   * Não entram na fila — misturá-los é o defeito que a Central pagou em 20/08,
   * quando 8 de 11 alertas eram teste do próprio dono e a fila inteira virou
   * algo a ignorar. Mas esconder o número faria parecer que ninguém testou.
   */
  internos: number
  /**
   * A leitura bateu no teto?
   *
   * O `.limit()` existe porque o PostgREST corta em 1.000 linhas e **não
   * devolve erro** — defeito que já custou três funções deste projeto (0032,
   * 0033). Devolver este sinal é o que impede a tela de mentir por omissão,
   * que era a lacuna registrada na verificação de 30/08.
   */
  bateuNoTeto: boolean
  lidoEm: string
}

const TETO = 300

const VAZIO: FilaDeFeedback['contagem'] = {
  aberto: 0,
  em_andamento: 0,
  resolvido: 0,
  descartado: 0,
  total: 0,
  problemas: 0,
}

/**
 * A fila de relatos, para a Central de Suporte.
 *
 * Lê com `createAdminClient()` porque `feedback` tem RLS ligada e ZERO policy
 * (0060) — nenhum papel de usuário enxerga a tabela, e a Central já roda fora
 * da RLS e só em localhost.
 *
 * ## Devolve TODOS, e filtra na tela
 *
 * Antes esta função escondia o que estava silenciado, e a tela só oferecia
 * "reexibir tudo" — não havia como ver um item já tratado isoladamente. Agora
 * o status vive no BANCO (0061) e a fila inteira vem; quem escolhe o que ver é
 * quem está olhando.
 */
/**
 * `incluirInternos` traz também os relatos de conta do dono e de teste.
 *
 * Existe porque esconder por completo tornou a tela impossível de testar: em
 * 30/08 o dono mandou três relatos pelo produto, logado numa conta que está
 * na lista de `contas-internas.ts`, e a Central não os mostrou em lugar
 * nenhum — o rodapé dizia "4 relatos de conta interna, fora da fila" e não
 * havia como abri-los. Ele concluiu, com razão, que o canal não funcionava.
 *
 * O padrão continua sendo esconder: fila com teste dentro é fila que se
 * aprende a ignorar. O que muda é que agora existe a porta.
 */
export async function lerFilaDeFeedback(
  opcoes: { incluirInternos?: boolean } = {},
): Promise<FilaDeFeedback> {
  await exigirAmbienteLocal()

  const admin = createAdminClient()

  const { data: linhas, error } = await admin
    .from('feedback')
    .select(
      'id, tipo, status, mensagem, solucao, rota, plano, user_agent, workspace_id, user_id, interno, anexos, created_at, resolvido_em',
    )
    .order('created_at', { ascending: false })
    .limit(TETO)

  if (error) {
    console.error('lerFilaDeFeedback falhou', error)
    return {
      relatos: [],
      contagem: VAZIO,
      internos: 0,
      bateuNoTeto: false,
      lidoEm: new Date().toISOString(),
    }
  }

  const todos = linhas ?? []
  const deCliente = opcoes.incluirInternos ? todos : todos.filter((l) => !l.interno)

  const idsDeEmpresa = Array.from(
    new Set(deCliente.map((l) => l.workspace_id).filter(Boolean)),
  )
  const { data: empresas } = idsDeEmpresa.length
    ? await admin.from('workspaces').select('id, name').in('id', idsDeEmpresa as string[])
    : { data: [] }

  const nomePorId = new Map((empresas ?? []).map((w) => [w.id, w.name]))

  // Uma página de usuários e casamento em memória, em vez de um
  // `getUserById` por relato — que seria uma ida de rede por linha.
  const { data: usuarios } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const pessoaPorId = new Map(
    (usuarios?.users ?? []).map((u) => [
      u.id,
      {
        // `user_metadata.name` é o que o cadastro grava. Sem ele, o e-mail
        // serve de nome — é feio, mas é melhor que "Sem nome" para quem
        // precisa reconhecer a pessoa.
        nome: (u.user_metadata?.name as string | undefined)?.trim() || (u.email ?? 'Sem nome'),
        email: u.email ?? 'sem e-mail',
      },
    ]),
  )

  // As URLs assinadas de TODOS os anexos, numa chamada por relato com anexo.
  // Uma hora de validade: a Central é aberta e usada na hora, e link longo de
  // arquivo com print de cliente é superfície que não precisa existir.
  const relatos: RelatoNaTela[] = await Promise.all(
    deCliente.map(async (l) => {
      const lista = (l.anexos ?? []) as AnexoDeFeedback[]
      let anexos: AnexoNaTela[] = []

      if (lista.length > 0) {
        const { data: assinadas } = await admin.storage
          .from(ANEXO_BUCKET)
          .createSignedUrls(
            lista.map((a) => a.caminho),
            3600,
          )

        anexos = lista.map((a, i) => ({
          ...a,
          url: assinadas?.[i]?.signedUrl ?? null,
          // Pelo caminho, não pelo nome original: o nome vem de quem enviou e
          // pode não ter extensão nenhuma. O caminho é montado pelo servidor
          // a partir do formato detectado nos bytes.
          ehImagem: !a.caminho.endsWith('.pdf'),
        }))
      }

      return {
        id: l.id,
        tipo: l.tipo,
        status: l.status,
        mensagem: l.mensagem,
        solucao: l.solucao,
        rota: l.rota,
        plano: l.plano,
        userAgent: l.user_agent,
        criadoEm: l.created_at,
        resolvidoEm: l.resolvido_em,
        // A empresa pode ter sido apagada — e é justamente o caso que mais
        // interessa ler, porque o relato pode explicar por que ela saiu.
        empresa: (l.workspace_id && nomePorId.get(l.workspace_id)) || 'Empresa apagada',
        pessoa: (l.user_id && pessoaPorId.get(l.user_id)) || {
          nome: 'Conta apagada',
          email: 'sem e-mail',
        },
        interno: Boolean(l.interno),
        anexos,
      }
    }),
  )

  const contagem = { ...VAZIO, total: relatos.length }
  for (const r of relatos) {
    contagem[r.status] += 1
    if (r.tipo === 'problema') contagem.problemas += 1
  }

  return {
    relatos,
    contagem,
    internos: todos.filter((l) => l.interno).length,
    bateuNoTeto: todos.length === TETO,
    lidoEm: new Date().toISOString(),
  }
}
