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

  const counts = new Map<DealStage, number>()
  for (const row of data ?? []) {
    counts.set(row.stage, Number(row.total))
  }

  return dealStages.map((stage) => ({
    stage,
    label: dealStageLabels[stage],
    count: counts.get(stage) ?? 0,
  }))
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
      console.error('getUpcomingDeals: contagem de abertos sem prazo falhou', erroContagem)
    }

    return { deals: [], abertosSemPrazo: count ?? 0 }
  }

  const leadIds = Array.from(new Set(data.map((d) => d.lead_id).filter((id): id is string => !!id)))
  const ownerIds = Array.from(new Set(data.map((d) => d.owner_id).filter((id): id is string => !!id)))

  const [leadsResult, ownerNames] = await Promise.all([
    leadIds.length > 0
      ? supabase.from('leads').select('id, company').in('id', leadIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length > 0 ? getMemberNames(workspaceId, ownerIds) : Promise.resolve(new Map()),
  ])

  const companyById = new Map((leadsResult.data ?? []).map((l) => [l.id, l.company]))

  return {
    deals: data.map((deal) => ({
      id: deal.id,
      title: deal.title,
      stage: deal.stage,
      value: deal.value,
      due_date: deal.due_date,
      lead_company: deal.lead_id ? companyById.get(deal.lead_id) ?? null : null,
      owner_name: deal.owner_id ? ownerNames.get(deal.owner_id) ?? null : null,
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
