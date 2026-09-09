import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { ehContaDeTeste } from './contas-internas'
import { exigirAmbienteLocal } from './somente-local'
import type { EmpresaNaCentral, NumerosDaCentral } from './tipos'

/**
 * Teto explícito em toda busca.
 *
 * O PostgREST corta em 1.000 linhas **em silêncio**: a resposta volta 200, sem
 * erro, com menos dados do que existe. Este projeto já pagou essa armadilha
 * três vezes (funil, Kanban e seletor de leads mentindo em silêncio, migration
 * 0032). Aqui o teto é alto de propósito — hoje a base inteira tem 54 negócios,
 * então 5.000 dá anos de folga — e quando alguma busca ENCOSTAR nele, a tela
 * avisa que o número pode estar cortado em vez de mentir.
 */
const TETO = 5000

/** Uma semana, em milissegundos. */
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000

type LinhaDeEmpresa = {
  id: string
  name: string
  created_at: string
  created_by: string | null
  telefone: string | null
  whatsapp: string | null
  utm_campaign: string | null
  /** De onde a URL diz que veio. Escrito pela nossa própria URL de anúncio. */
  utm_source: string | null
  /** Qual criativo trouxe (migration 0069). Ver `atribuicao.ts`. */
  utm_content: string | null
  fbc: string | null
  /** O id do clique do Google (migration 0071). Ver `atribuicao.ts`. */
  gclid: string | null
  /**
   * Fim do trial. É o que separa "tem Pro porque paga" de "tem Pro porque
   * ganhou sete dias" — e `pro_vigente()` devolve `true` para os dois, porque
   * ela responde "pode usar?", não "pagou?".
   */
  trial_ate: string | null
}

type LinhaDeAssinatura = {
  workspace_id: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  current_period_end: string | null
  asaas_subscription_id: string | null
}

export type LeituraDoBanco = {
  numeros: NumerosDaCentral
  empresas: EmpresaNaCentral[]
  assinaturas: LinhaDeAssinatura[]
  podeEstarCortado: boolean
  errosRecentes: number
  /** Id do erro mais recente de cliente, ou `null`. Ver `pendencias.ts`. */
  idDoErroMaisRecente: string | null
  /**
   * Todo e-mail que pertence a uma conta de verdade.
   *
   * Existe para separar cliente travado de lixo de script no filtro de
   * pendências: um e-mail que voltou (bounce) para um endereço que ninguém
   * usou para se cadastrar é ruído de teste, não problema de cliente. Ver o
   * comentário do filtro em `pendencias.ts`.
   */
  emailsDeContasReais: Set<string>
}

/**
 * Lê o retrato do negócio inteiro: todas as empresas, quem é dono de cada uma,
 * quanto cada uma usa, e quem está pagando de verdade.
 *
 * ## Por que uma consulta por empresa para saber quem é Pro
 *
 * `pro_vigente(uuid)` é chamada uma vez por empresa, em paralelo. Parece
 * desperdício e é deliberado: a doutrina travada deste projeto é **"regra de
 * plano lê a função, nunca a coluna"**. `workspaces.plan` é só o último valor
 * gravado e não sabe que o tempo passou — foi exatamente essa confusão que
 * causou o bug da migration 0028 (Pro vencido aceitando o terceiro membro e a
 * trigger de leads recusando o lead dele).
 *
 * Reescrever a lógica de `pro_vigente` em TypeScript seria mais rápido e
 * criaria uma TERCEIRA verdade sobre quem é Pro, que diverge da função na
 * primeira mudança de carência (`dias_de_graca`, migration 0044). Com 26
 * empresas, o paralelo resolve em uma fração de segundo. Se um dia isso doer,
 * vira uma RPC que agrega no banco — não uma cópia da regra aqui.
 *
 * ## Por que `auth.admin.listUsers`
 *
 * Não existe tabela `profiles` neste projeto: nome e e-mail vivem só em
 * `auth.users`, que fica fora do schema exposto pelo PostgREST (documentado em
 * `lib/leads/queries.ts:166-169`), então não dá para fazer join. O precedente
 * de resolver identidade por admin client é `lib/asaas/aplicar-evento.ts:151`.
 */
export async function lerBanco(): Promise<LeituraDoBanco> {
  await exigirAmbienteLocal()

  const supabase = createAdminClient()

  const [usuarios, empresasRes, membrosRes, assinaturasRes, contatosRes, negociosRes, errosRes] =
    await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase
        .from('workspaces')
        .select(
          'id, name, created_at, created_by, telefone, whatsapp, utm_campaign, utm_source, utm_content, fbc, gclid, trial_ate',
        )
        .order('created_at', { ascending: false })
        .limit(TETO),
      supabase.from('workspace_members').select('workspace_id, user_id').limit(TETO),
      supabase
        .from('subscriptions')
        .select('workspace_id, status, current_period_end, asaas_subscription_id')
        .limit(TETO),
      // Só a coluna de agrupamento: trazer o lead inteiro para contar seria
      // pagar rede por dado que ninguém lê. Mesma disciplina de
      // `ProximaAcaoRow` (`lib/deals/queries.ts`), onde um `select` largo em
      // rota sem paginação dobrou o custo medido da rota.
      supabase.from('leads').select('workspace_id').limit(TETO),
      supabase.from('deals').select('workspace_id').limit(TETO),
      // Só erro de CLIENTE. A 0058 separou `interno` justamente porque 52 dos
      // 73 registros vinham de `localhost` e de contas nossas — e um alerta
      // que diz "73 erros" quando 4 são de gente real ensina a ignorar o
      // alerta. Mesma classe do ruído nos outros alertas desta tela.
      // `head: false` e uma linha: além da contagem, o alerta precisa do id do
      // erro mais NOVO para se identificar. Sem ele o alerta tem id fixo, e
      // silenciar apaga a categoria inteira para sempre — ver `pendencias.ts`.
      supabase
        .from('error_logs')
        .select('id', { count: 'exact' })
        .eq('interno', false)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

  const empresas = (empresasRes.data ?? []) as LinhaDeEmpresa[]
  const membros = membrosRes.data ?? []
  const assinaturas = (assinaturasRes.data ?? []) as LinhaDeAssinatura[]
  const contatos = contatosRes.data ?? []
  const negocios = negociosRes.data ?? []

  // Encostar no teto significa que pode haver mais linhas que não vieram. Não
  // dá para saber quantas — só que o número mostrado é um piso, não o total.
  const podeEstarCortado = [empresas, membros, assinaturas, contatos, negocios].some(
    (lista) => lista.length >= TETO,
  )

  const porUsuario = new Map(usuarios.data.users.map((u) => [u.id, u]))
  const assinaturaPorEmpresa = new Map(assinaturas.map((s) => [s.workspace_id, s]))
  const contar = (lista: { workspace_id: string }[]) => {
    const mapa = new Map<string, number>()
    for (const item of lista) {
      mapa.set(item.workspace_id, (mapa.get(item.workspace_id) ?? 0) + 1)
    }
    return mapa
  }
  const membrosPorEmpresa = contar(membros)
  const contatosPorEmpresa = contar(contatos)
  const negociosPorEmpresa = contar(negocios)

  // A fonte da verdade sobre quem paga. Ver o bloco de documentação acima.
  const vigencias = await Promise.all(
    empresas.map(async (empresa) => {
      const { data } = await supabase.rpc('pro_vigente', { target_workspace_id: empresa.id })
      return [empresa.id, data === true] as const
    }),
  )
  const proVigentePorEmpresa = new Map(vigencias)

  const lista: EmpresaNaCentral[] = empresas.map((empresa) => {
    const dono = empresa.created_by ? porUsuario.get(empresa.created_by) : undefined
    const assinatura = assinaturaPorEmpresa.get(empresa.id)

    return {
      id: empresa.id,
      nome: empresa.name,
      // `name` nos metadados é o que o cadastro grava; o e-mail entra como
      // reserva para a linha nunca aparecer sem identificação nenhuma.
      dono: (dono?.user_metadata?.name as string | undefined) ?? dono?.email ?? null,
      email: dono?.email ?? null,
      telefone: empresa.whatsapp ?? empresa.telefone ?? null,
      pagando: proVigentePorEmpresa.get(empresa.id) ?? false,
      // Os sinais crus, para `central.ts` cruzar com o Asaas e classificar.
      // A classificação NÃO acontece aqui de propósito: este arquivo só
      // conhece o banco, e decidir "é receita?" sem o gateway foi exatamente
      // o defeito de 30/08.
      emTrial: Boolean(empresa.trial_ate && new Date(empresa.trial_ate) > new Date()),
      // `ehContaDeTeste`, a função OFICIAL — inclui os e-mails do dono e os
      // domínios descartáveis, que `ehContaInterna` (4 endereços) deixava
      // passar como cliente.
      interna: ehContaDeTeste(dono?.email),
      statusAssinatura: assinatura?.status ?? null,
      proVenceEm: assinatura?.current_period_end ?? null,
      criadoEm: empresa.created_at,
      ultimoAcesso: dono?.last_sign_in_at ?? null,
      quantidadeDeMembros: membrosPorEmpresa.get(empresa.id) ?? 0,
      quantidadeDeContatos: contatosPorEmpresa.get(empresa.id) ?? 0,
      quantidadeDeNegocios: negociosPorEmpresa.get(empresa.id) ?? 0,
      utmCampaign: empresa.utm_campaign,
      utmSource: empresa.utm_source,
      utmContent: empresa.utm_content,
      // `fbc` só existe quando a pessoa chegou por um clique de anúncio do
      // Meta (`fbclid` na URL), gravado por `components/landing/utm-capture.tsx`.
      veioDeCliqueDeAnuncio: Boolean(empresa.fbc),
      // O par do de cima para o Google. A coluna existe desde a 0071 (04/09) e
      // esta linha é o PRIMEIRO consumidor dela — até aqui o `gclid` era
      // capturado, gravado e lido por ninguém.
      veioDeCliqueDoGoogle: Boolean(empresa.gclid),
    }
  })

  // ## A receita NÃO é calculada aqui, e essa é a correção de 30/08
  //
  // Este arquivo só conhece o banco. Até hoje ele fazia
  // `pro_vigente() * R$ 49` e chamava isso de receita — mas `pro_vigente()`
  // é `assinatura viva OU trial válido`, então 10 empresas em trial gratuito
  // viravam R$ 490,00/mês. Medido contra o Asaas no mesmo dia: entrou
  // R$ 49,00, uma vez, em 13/08, e foi o dono provando o próprio checkout.
  //
  // Quem decide o que é dinheiro é `lib/dono/receita.ts`, chamado de
  // `central.ts`, onde o banco e o gateway se encontram. Aqui ficam só
  // contagens que o banco de fato conhece.
  const limiteDaSemana = Date.now() - SETE_DIAS

  return {
    numeros: {
      contasCriadas: lista.length,
      novasEm7Dias: lista.filter((e) => new Date(e.criadoEm).getTime() >= limiteDaSemana).length,
    },
    empresas: lista,
    assinaturas,
    podeEstarCortado,
    errosRecentes: errosRes.count ?? 0,
    idDoErroMaisRecente: errosRes.data?.[0]?.id ?? null,
    emailsDeContasReais: new Set(
      usuarios.data.users.map((u) => u.email).filter((e): e is string => Boolean(e)),
    ),
  }
}
