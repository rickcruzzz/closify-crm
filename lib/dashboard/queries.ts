import { createClient } from '@/lib/supabase/server'
import { dealStageLabels, dealStages, type DealStage } from '@/lib/deals/types'

export type DashboardMetrics = {
  totalLeads: number
  openDeals: number
  pipelineValue: number
  /**
   * Fechados e ganhos vêm CRUS, em vez de já divididos.
   *
   * A versão anterior devolvia só `conversionRate` e descartava os dois
   * números que a produziram. Com um único negócio fechado o card exibia
   * "100%", que é verdade aritmética e mentira de leitura. Quem monta o texto
   * é `textoDaConversao` (`lib/dashboard/conversao.ts`), que não consegue
   * mostrar o percentual sem a base ao lado.
   */
  closedDeals: number
  wonDeals: number
}

/**
 * O que "Negócios mais próximos do prazo" precisa saber para não mentir.
 *
 * A lista sozinha não bastava: ela sai vazia tanto quando a empresa não tem
 * negócio nenhum quanto quando tem vários e nenhum com prazo marcado — e o
 * estado vazio dizia "Nenhum negócio em aberto" nos dois casos, ao lado de um
 * card informando quatro negócios abertos (medido em 26/08/2026).
 */
export type ProximosPrazos = {
  deals: UpcomingDeal[]
  /** Quantos negócios abertos existem sem prazo marcado. Só é contado quando a lista sai vazia. */
  abertosSemPrazo: number
}

export type FunnelStageCount = {
  stage: DealStage
  label: string
  count: number
  /**
   * Soma de `value` dos negocios da etapa.
   *
   * Nasceu na 0088, junto do consumidor dela. Coluna gravada e nunca lida e a
   * classe de defeito que este projeto pagou tres vezes (`utm_content`,
   * `gclid`, `utm_campaign`) — aqui o valor sai do banco porque a lista de
   * etapas passou a mostra-lo na mesma linha da contagem.
   */
  valor: number
}

/** O que `get_funnel_performance` devolve, ja em camelCase. */
export type DesempenhoDoFunil = {
  valorGanho: number
  valorPerdido: number
  negociosGanhos: number
  negociosPerdidos: number
  ticketMedio: number | null
  diasAteFechar: number | null
}

export type UpcomingDeal = {
  id: string
  title: string
  stage: DealStage
  value: number
  due_date: string | null
  lead_company: string | null
  owner_name: string | null
}

/** ISO. `desde`/`ate` filtram por `created_at`, quando o lead/negócio nasceu. */
export type PeriodoDoDashboard = { desde: string; ate: string }

const CLOSED_STAGES: DealStage[] = ['fechado_ganho', 'fechado_perdido']

// Dashboard agrega no servidor via count/sum em vez de buscar todas as
// linhas e somar em memória, com um workspace grande (milhares de deals),
// trazer tudo pra somar em JS desperdiça banda e memória para um número que
// o Postgres já calcula de forma mais barata. Os 4 counts (leads, deals
// abertos/fechados/ganhos) saem numa única RPC em vez de 4 queries
// count:exact separadas, para reduzir round-trips de rede.
export async function getDashboardMetrics(
  workspaceId: string,
  periodo?: PeriodoDoDashboard,
): Promise<DashboardMetrics> {
  const supabase = await createClient()

  const [countsResult, pipelineValueResult] = await Promise.all([
    supabase
      .rpc('get_dashboard_counts', {
        target_workspace_id: workspaceId,
        desde: periodo?.desde ?? null,
        ate: periodo?.ate ?? null,
      })
      .single(),
    supabase.rpc('get_open_pipeline_value', {
      target_workspace_id: workspaceId,
      desde: periodo?.desde ?? null,
      ate: periodo?.ate ?? null,
    }),
  ])

  const counts = countsResult.data
  const closedCount = counts?.closed_deals ?? 0
  const wonCount = counts?.won_deals ?? 0

  return {
    totalLeads: counts?.total_leads ?? 0,
    openDeals: counts?.open_deals ?? 0,
    pipelineValue: pipelineValueResult.data ?? 0,
    closedDeals: closedCount,
    wonDeals: wonCount,
  }
}

/**
 * Contagem por etapa, agrupada no BANCO.
 *
 * A versão anterior trazia uma linha por negócio e contava em memória, e o
 * PostgREST corta em 1.000 linhas sem devolver erro. Medido em produção: com
 * 1.100 negócios o gráfico mostrava 1.000, calado. Não era lentidão, era
 * número errado na tela do cliente.
 *
 * Agora são no máximo 6 linhas, independentemente do tamanho do funil.
 */
export async function getFunnelCounts(
  workspaceId: string,
  periodo?: PeriodoDoDashboard,
): Promise<FunnelStageCount[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_funnel_counts', {
    target_workspace_id: workspaceId,
    desde: periodo?.desde ?? null,
    ate: periodo?.ate ?? null,
  })

  if (error) {
    console.error('getFunnelCounts falhou', error)
  }

  const porEtapa = new Map<DealStage, { count: number; valor: number }>()
  for (const row of data ?? []) {
    porEtapa.set(row.stage, { count: Number(row.total), valor: Number(row.valor ?? 0) })
  }

  return dealStages.map((stage) => ({
    stage,
    label: dealStageLabels[stage],
    count: porEtapa.get(stage)?.count ?? 0,
    valor: porEtapa.get(stage)?.valor ?? 0,
  }))
}

/**
 * Ticket medio, ciclo e o dinheiro ganho e perdido no periodo.
 *
 * Erro nao derruba a tela: devolve tudo zerado com `null` nas medias, e
 * `medidasDeDesempenho` ja trata `null` como "nao mostrar". Um painel
 * secundario que quebra a pagina inteira e pior do que um painel ausente.
 */
export async function getFunnelPerformance(
  workspaceId: string,
  periodo?: PeriodoDoDashboard,
): Promise<DesempenhoDoFunil> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .rpc('get_funnel_performance', {
      target_workspace_id: workspaceId,
      desde: periodo?.desde ?? null,
      ate: periodo?.ate ?? null,
    })
    .single()

  if (error) {
    console.error('getFunnelPerformance falhou', error)
  }

  const linha = data as {
    valor_ganho: number | null
    valor_perdido: number | null
    negocios_ganhos: number | null
    negocios_perdidos: number | null
    ticket_medio: number | null
    dias_ate_fechar: number | null
  } | null

  return {
    valorGanho: Number(linha?.valor_ganho ?? 0),
    valorPerdido: Number(linha?.valor_perdido ?? 0),
    negociosGanhos: Number(linha?.negocios_ganhos ?? 0),
    negociosPerdidos: Number(linha?.negocios_perdidos ?? 0),
    // `?? null` e nao `?? 0`: media de nada e ausencia, e `desempenho.ts`
    // depende dessa distincao para calar em vez de afirmar zero.
    ticketMedio:
      linha?.ticket_medio === null || linha?.ticket_medio === undefined
        ? null
        : Number(linha.ticket_medio),
    diasAteFechar:
      linha?.dias_ate_fechar === null || linha?.dias_ate_fechar === undefined
        ? null
        : Number(linha.dias_ate_fechar),
  }
}

/**
 * Quantos negocios ABERTOS estao sem valor preenchido.
 *
 * Medido em producao em 16/09: 119 de 132 negocios tem `value` zerado. Sem
 * este numero a coluna de valor mostra "R$ 0" em quase toda linha e le como
 * defeito do sistema, quando e campo em branco.
 *
 * `head: true` com `count: exact`: conta no banco, sem trazer linha — o mesmo
 * padrao que `getUpcomingDeals` usa para "abertos sem prazo".
 */
export async function contarAbertosSemValor(
  workspaceId: string,
  periodo?: PeriodoDoDashboard,
): Promise<number> {
  const supabase = await createClient()

  let consulta = supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .not('stage', 'in', `(${CLOSED_STAGES.join(',')})`)
    .eq('value', 0)

  if (periodo) {
    consulta = consulta.gte('created_at', periodo.desde).lte('created_at', periodo.ate)
  }

  const { count, error } = await consulta
  if (error) {
    console.error('contarAbertosSemValor falhou', error)
    return 0
  }
  return count ?? 0
}

export async function getUpcomingDeals(
  workspaceId: string,
  limit = 5,
): Promise<ProximosPrazos> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deals')
    .select('id, title, stage, value, due_date, owner_id, lead_id')
    .eq('workspace_id', workspaceId)
    .not('stage', 'in', `(${CLOSED_STAGES.join(',')})`)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })
    .limit(limit)

  // Erro não checado vira `data` nulo, que aqui é indistinguível de "nenhum
  // prazo" — a tela mostraria estado vazio para uma falha de leitura.
  if (error) {
    console.error('getUpcomingDeals falhou', error)
  }

  if (!data || data.length === 0) {
    // Só agora, e só neste caminho: a pergunta "existe negócio aberto sem
    // prazo?" só importa quando a lista saiu vazia. Contagem agregada no
    // banco, sem trazer linha.
    const { count, error: erroContagem } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .not('stage', 'in', `(${CLOSED_STAGES.join(',')})`)
      .is('due_date', null)

    if (erroContagem) {
      console.error(
        'getUpcomingDeals: contagem de abertos sem prazo falhou',
        erroContagem,
      )
    }

    return { deals: [], abertosSemPrazo: count ?? 0 }
  }

  const leadIds = Array.from(
    new Set(data.map((d) => d.lead_id).filter((id): id is string => !!id)),
  )
  const ownerIds = Array.from(
    new Set(data.map((d) => d.owner_id).filter((id): id is string => !!id)),
  )

  const [leadsResult, ownerNames] = await Promise.all([
    leadIds.length > 0
      ? supabase.from('leads').select('id, company').in('id', leadIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length > 0
      ? getMemberNames(workspaceId, ownerIds)
      : Promise.resolve(new Map()),
  ])

  const companyById = new Map((leadsResult.data ?? []).map((l) => [l.id, l.company]))

  return {
    deals: data.map((deal) => ({
      id: deal.id,
      title: deal.title,
      stage: deal.stage,
      value: deal.value,
      due_date: deal.due_date,
      lead_company: deal.lead_id ? (companyById.get(deal.lead_id) ?? null) : null,
      owner_name: deal.owner_id ? (ownerNames.get(deal.owner_id) ?? null) : null,
    })),
    abertosSemPrazo: 0,
  }
}

async function getMemberNames(
  workspaceId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_workspace_member_names', {
    target_workspace_id: workspaceId,
    target_user_ids: userIds,
  })

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.user_id, row.name)
  }
  return map
}
