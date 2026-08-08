import type { Metadata } from 'next'
import {
  getDashboardMetrics,
  getFunnelCounts,
  getUpcomingDeals,
} from '@/lib/dashboard/queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCards } from '@/components/dashboard/metric-cards'
import { FunnelChart } from '@/components/dashboard/funnel-chart'
import { UpcomingDealsTable } from '@/components/dashboard/upcoming-deals-table'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const { workspaceId } = await getCurrentUserAndWorkspace()

  const [metrics, funnelData, upcomingDeals] = await Promise.all([
    getDashboardMetrics(workspaceId),
    getFunnelCounts(workspaceId),
    getUpcomingDeals(workspaceId),
  ])

  // O dashboard mostra os três painéis sempre, inclusive em workspace novo.
  // Antes o guia de primeiros passos entrava aqui e escondia funil e prazos
  // até existir dado — o que deixava a tela do recém-chegado sem a forma do
  // produto e mudava o layout debaixo dele assim que o primeiro negócio
  // entrava. Cada painel já tem estado vazio próprio, e o guia mudou para o
  // Pipeline, onde a ação de fato acontece.
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Métricas do seu funil de vendas." />

      <MetricCards metrics={metrics} />

      <FunnelChart data={funnelData} />

      <UpcomingDealsTable deals={upcomingDeals} />
    </div>
  )
}
