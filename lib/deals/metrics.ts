import { dealStageLabels, dealStages, type Deal } from '@/lib/deals/types'
import type { Lead } from '@/lib/leads/types'

export type DashboardMetrics = {
  totalLeads: number
  openDeals: number
  pipelineValue: number
  conversionRate: number
}

export function computeMetrics(deals: Deal[], leads: Lead[]): DashboardMetrics {
  const openDeals = deals.filter(
    (deal) => deal.stage !== 'fechado_ganho' && deal.stage !== 'fechado_perdido',
  )
  const closedDeals = deals.filter(
    (deal) => deal.stage === 'fechado_ganho' || deal.stage === 'fechado_perdido',
  )
  const wonDeals = deals.filter((deal) => deal.stage === 'fechado_ganho')

  const pipelineValue = openDeals.reduce((sum, deal) => sum + deal.value, 0)
  const conversionRate =
    closedDeals.length > 0 ? (wonDeals.length / closedDeals.length) * 100 : 0

  return {
    totalLeads: leads.length,
    openDeals: openDeals.length,
    pipelineValue,
    conversionRate,
  }
}

export type FunnelStageCount = {
  stage: (typeof dealStages)[number]
  label: string
  count: number
}

export function computeFunnel(deals: Deal[]): FunnelStageCount[] {
  return dealStages.map((stage) => ({
    stage,
    label: dealStageLabels[stage],
    count: deals.filter((deal) => deal.stage === stage).length,
  }))
}

export function upcomingDeals(deals: Deal[], limit = 5): Deal[] {
  return [...deals]
    .filter((deal) => deal.stage !== 'fechado_ganho' && deal.stage !== 'fechado_perdido')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, limit)
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function formatCompactBRL(value: number): string {
  const compact = new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
  return `R$ ${compact}`
}
