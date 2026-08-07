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
import { GettingStartedCard } from '@/components/dashboard/getting-started-card'
import { UpcomingDealsTable } from '@/components/dashboard/upcoming-deals-table'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const { workspaceId } = await getCurrentUserAndWorkspace()

  const [metrics, funnelData, upcomingDeals] = await Promise.all([
    getDashboardMetrics(workspaceId),
    getFunnelCounts(workspaceId),
    getUpcomingDeals(workspaceId),
  ])

  // Workspace recém-criado: funil e prazos só teriam estados vazios repetindo
  // o mesmo CTA, então mostra o guia no lugar deles até existir algum dado.
  const isNewWorkspace =
    metrics.totalLeads === 0 && funnelData.every((s) => s.count === 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Métricas do seu funil de vendas." />

      {isNewWorkspace && <GettingStartedCard />}

      <MetricCards metrics={metrics} />

      {!isNewWorkspace && (
        <>
          <FunnelChart data={funnelData} />

          <UpcomingDealsTable deals={upcomingDeals} />
        </>
      )}
    </div>
  )
}
