import { createClient } from '@/lib/supabase/server'
import { dealStageLabels, dealStages, type DealStage } from '@/lib/deals/types'

export type DashboardMetrics = {
  totalLeads: number
  openDeals: number
  pipelineValue: number
  conversionRate: number
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

const CLOSED_STAGES: DealStage[] = ['fechado_ganho', 'fechado_perdido']

// Dashboard agrega no servidor via count/sum em vez de buscar todas as
// linhas e somar em memória — com um workspace grande (milhares de deals),
// trazer tudo pra somar em JS desperdiça banda e memória para um número que
// o Postgres já calcula de forma mais barata. Os 4 counts (leads, deals
// abertos/fechados/ganhos) saem numa única RPC em vez de 4 queries
// count:exact separadas, para reduzir round-trips de rede.
export async function getDashboardMetrics(workspaceId: string): Promise<DashboardMetrics> {
  const supabase = await createClient()

  const [countsResult, pipelineValueResult] = await Promise.all([
    supabase.rpc('get_dashboard_counts', { target_workspace_id: workspaceId }).single(),
    supabase.rpc('get_open_pipeline_value', { target_workspace_id: workspaceId }),
  ])

  const counts = countsResult.data
  const closedCount = counts?.closed_deals ?? 0
  const wonCount = counts?.won_deals ?? 0

  return {
    totalLeads: counts?.total_leads ?? 0,
    openDeals: counts?.open_deals ?? 0,
    pipelineValue: pipelineValueResult.data ?? 0,
    conversionRate: closedCount > 0 ? (wonCount / closedCount) * 100 : 0,
  }
}

/**
 * Contagem por etapa, agrupada no BANCO.
 *
 * A versão anterior trazia uma linha por negócio e contava em memória — e o
 * PostgREST corta em 1.000 linhas sem devolver erro. Medido em produção: com
 * 1.100 negócios o gráfico mostrava 1.000, calado. Não era lentidão, era
 * número errado na tela do cliente.
 *
 * Agora são no máximo 6 linhas, independentemente do tamanho do funil.
 */
export async function getFunnelCounts(workspaceId: string): Promise<FunnelStageCount[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_funnel_counts', {
    target_workspace_id: workspaceId,
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

export async function getUpcomingDeals(workspaceId: string, limit = 5): Promise<UpcomingDeal[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('deals')
    .select('id, title, stage, value, due_date, owner_id, lead_id')
    .eq('workspace_id', workspaceId)
    .not('stage', 'in', `(${CLOSED_STAGES.join(',')})`)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })
    .limit(limit)

  if (!data || data.length === 0) return []

  const leadIds = Array.from(new Set(data.map((d) => d.lead_id).filter((id): id is string => !!id)))
  const ownerIds = Array.from(new Set(data.map((d) => d.owner_id).filter((id): id is string => !!id)))

  const [leadsResult, ownerNames] = await Promise.all([
    leadIds.length > 0
      ? supabase.from('leads').select('id, company').in('id', leadIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length > 0 ? getMemberNames(workspaceId, ownerIds) : Promise.resolve(new Map()),
  ])

  const companyById = new Map((leadsResult.data ?? []).map((l) => [l.id, l.company]))

  return data.map((deal) => ({
    id: deal.id,
    title: deal.title,
    stage: deal.stage,
    value: deal.value,
    due_date: deal.due_date,
    lead_company: deal.lead_id ? companyById.get(deal.lead_id) ?? null : null,
    owner_name: deal.owner_id ? ownerNames.get(deal.owner_id) ?? null : null,
  }))
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
