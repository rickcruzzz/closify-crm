import 'server-only'

import { escolherRemetente } from '@/lib/conversas/remetente'
import { normalizarTelefoneBrasileiro } from '@/lib/leads/whatsapp'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  MAXIMO_DE_TENTATIVAS,
  deveReenviar,
  umaPorConversa,
  type MensagemDaFila,
} from '@/lib/whatsapp/reenvio'

export type ResultadoDaFila = {
  naFila: number
  reenviadas: number
  aindaFalhando: number
  desistidas: number
  seguradasPeloTeto: number
  erros: string[]
}

/**
 * Reenvia o que falhou ao sair, respeitando o teto de aquecimento.
 *
 * ## O que ela conserta
 *
 * `lib/conversas/actions.ts` grava a linha como `pendente`, tenta entregar, e
 * marca `falhou` com o motivo quando o provedor recusa. Isso está certo e
 * **não perde o dado**. O que faltava era alguém tentar de novo: uma
 * indisponibilidade de trinta segundos da Z-API deixava a mensagem parada para
 * sempre, num produto cuja promessa é não perder venda por esquecimento.
 *
 * ## O teto de aquecimento vale AQUI TAMBÉM, e essa é a parte cara
 *
 * O número em risco é o **do cliente**. Uma fila represada por um incidente de
 * duas horas poderia despejar quarenta mensagens de uma vez no minuto em que o
 * provedor voltasse, e volume súbito é o primeiro dos quatro padrões que
 * derrubam número — `docs/mercado/limites-e-bloqueios.md`.
 *
 * Por isso a regra do teto é a MESMA de `enviarMensagem`: `tetoPorHora` do
 * próprio remetente, contando as enviadas da última hora daquela empresa. O
 * que muda é só o cliente do banco, porque aqui não há sessão.
 *
 * ## Uma empresa de cada vez, e uma mensagem por conversa
 *
 * O teto é por empresa, então a fila é agrupada por empresa antes de qualquer
 * envio. Dentro de cada uma, `umaPorConversa` garante que duas mensagens da
 * mesma conversa não saiam na mesma rodada: elas foram escritas numa ordem, e
 * reenviar as duas juntas permite que a segunda chegue antes da primeira.
 */
export async function reenviarMensagensQueFalharam(opcoes: {
  teto?: number
}): Promise<ResultadoDaFila> {
  const tetoDaRodada = opcoes.teto ?? 40
  const supabase = createAdminClient()
  const erros: string[] = []

  const { data: linhas, error } = await supabase
    .from('mensagens')
    .select('id, conversa_id, workspace_id, texto, external_id, tentativas, created_at')
    .eq('direcao', 'enviada')
    .eq('status', 'falhou')
    .is('external_id', null)
    .order('created_at', { ascending: true })
    .limit(tetoDaRodada * 5)

  if (error) throw error

  const candidatas = linhas ?? []
  if (candidatas.length === 0) {
    return { naFila: 0, reenviadas: 0, aindaFalhando: 0, desistidas: 0, seguradasPeloTeto: 0, erros }
  }

  // ## O telefone vive no LEAD, e eu supus que vivia na conversa
  //
  // `conversas` tem `lead_id` e nao tem `telefone` — conferido no catalogo
  // depois de o compilador recusar a primeira versao. O caminho certo e o
  // mesmo que `conferirConversa` usa no envio normal: `conversas` -> `leads`.
  //
  // Em LOTE, e nao uma consulta por mensagem: quarenta mensagens dariam
  // oitenta viagens a Sao Paulo antes do primeiro envio.
  const conversaIds = Array.from(new Set(candidatas.map((m) => m.conversa_id)))
  const { data: conversas } = await supabase
    .from('conversas')
    .select('id, lead_id, leads!inner(phone)')
    .in('id', conversaIds)

  const telefonePorConversa = new Map<string, string | null>()
  for (const c of conversas ?? []) {
    const lead = Array.isArray(c.leads) ? c.leads[0] : c.leads
    telefonePorConversa.set(c.id, lead?.phone ?? null)
  }

  const fila: MensagemDaFila[] = candidatas.map((m) => ({
    id: m.id,
    conversaId: m.conversa_id,
    workspaceId: m.workspace_id,
    texto: m.texto,
    telefone: telefonePorConversa.get(m.conversa_id) ?? null,
    tentativas: m.tentativas ?? 0,
    externalId: m.external_id,
    criadaEm: m.created_at,
  }))

  let reenviadas = 0
  let aindaFalhando = 0
  let desistidas = 0
  let seguradasPeloTeto = 0

  // Agrupa por empresa: o teto de envio é por empresa, e misturá-las faria uma
  // gastar a vaga da outra.
  const porEmpresa = new Map<string, MensagemDaFila[]>()
  for (const m of fila) {
    const atual = porEmpresa.get(m.workspaceId) ?? []
    atual.push(m)
    porEmpresa.set(m.workspaceId, atual)
  }

  for (const [workspaceId, daEmpresa] of Array.from(porEmpresa.entries())) {
    const { data: conexao } = await supabase
      .from('whatsapp_instances')
      .select('status, conectada_em')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    // Sem número conectado não há o que tentar. A mensagem fica na fila: quando
    // a pessoa reconectar, a rodada seguinte a pega. Marcar desistência aqui
    // puniria a mensagem por um problema que é da conexão.
    if (conexao?.status !== 'conectado') continue

    const remetente = escolherRemetente(workspaceId)
    const teto = remetente.tetoPorHora(conexao.conectada_em)

    let vagas = Number.POSITIVE_INFINITY
    if (teto !== null) {
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count, error: erroDaContagem } = await supabase
        .from('mensagens')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('direcao', 'enviada')
        .gte('created_at', umaHoraAtras)

      if (erroDaContagem) {
        // Sem saber quantas saíram, não envia. Mesma decisão de
        // `conferirTetoDeEnvio`: segurar uma mensagem é muito mais barato que
        // queimar o número do cliente.
        erros.push(`${workspaceId.slice(0, 8)}: falha ao contar o teto`)
        continue
      }
      vagas = Math.max(0, teto - (count ?? 0))
    }

    for (const m of umaPorConversa(daEmpresa)) {
      const decisao = deveReenviar(m)

      if (!decisao.reenviar) {
        if (decisao.motivo === 'desistiu' || decisao.motivo === 'sem_destino') {
          desistidas += 1
          // Alto no log: a partir daqui ninguém mais tenta, e o silêncio é o
          // que esta fila existe para não produzir.
          console.error(
            `reenvio: DESISTINDO da mensagem ${m.id} (${decisao.motivo}) depois de ${m.tentativas} tentativa(s)`,
          )
        }
        continue
      }

      if (vagas <= 0) {
        seguradasPeloTeto += 1
        continue
      }

      vagas -= 1
      // A MESMA normalizacao do envio normal. Sem ela, um numero gravado como
      // "(71) 99330-9404" iria cru para o provedor, e a retentativa falharia
      // por um motivo diferente do original — o pior tipo de retentativa.
      const numero = normalizarTelefoneBrasileiro(m.telefone!) ?? m.telefone!
      const entrega = await remetente.enviarTexto(m.workspaceId, numero, m.texto)

      if (entrega.ok) {
        await supabase
          .from('mensagens')
          .update({
            status: 'enviada',
            external_id: entrega.externalId,
            erro: null,
            tentativas: m.tentativas + 1,
          })
          .eq('id', m.id)
        reenviadas += 1
        continue
      }

      aindaFalhando += 1
      const foiAUltima = m.tentativas + 1 >= MAXIMO_DE_TENTATIVAS
      await supabase
        .from('mensagens')
        .update({
          status: 'falhou',
          erro: entrega.motivo.slice(0, 300),
          tentativas: m.tentativas + 1,
        })
        .eq('id', m.id)

      if (foiAUltima) {
        desistidas += 1
        console.error(
          `reenvio: mensagem ${m.id} esgotou as ${MAXIMO_DE_TENTATIVAS} tentativas. Ultimo erro: ${entrega.motivo.slice(0, 120)}`,
        )
      }
    }
  }

  return {
    naFila: fila.length,
    reenviadas,
    aindaFalhando,
    desistidas,
    seguradasPeloTeto,
    erros: erros.slice(0, 5),
  }
}
