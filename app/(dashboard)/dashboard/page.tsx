import { getDashboardMetrics, getFunnelCounts, getUpcomingDeals } from '@/lib/dashboard/queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCards } from '@/components/dashboard/metric-cards'
import { FunnelChart } from '@/components/dashboard/funnel-chart'
import { UpcomingDealsTable } from '@/components/dashboard/upcoming-deals-table'

export default async function DashboardPage() {
  const { workspaceId } = await getCurrentUserAndWorkspace()

  const [metrics, funnelData, upcomingDeals] = await Promise.all([
    getDashboardMetrics(workspaceId),
    getFunnelCounts(workspaceId),
    getUpcomingDeals(workspaceId),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Métricas do seu funil de vendas." />

      <MetricCards metrics={metrics} />

      <FunnelChart data={funnelData} />

      <UpcomingDealsTable deals={upcomingDeals} />
    </div>
  )
}
