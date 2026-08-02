import { PageHeader } from '@/components/layout/page-header'
import { MetricCards } from '@/components/dashboard/metric-cards'
import { FunnelChart } from '@/components/dashboard/funnel-chart'
import { UpcomingDealsTable } from '@/components/dashboard/upcoming-deals-table'
import { mockDeals } from '@/lib/deals/mock-data'
import { computeFunnel, computeMetrics, upcomingDeals } from '@/lib/deals/metrics'
import { mockLeads } from '@/lib/leads/mock-data'

export default function DashboardPage() {
  const metrics = computeMetrics(mockDeals, mockLeads)
  const funnelData = computeFunnel(mockDeals)
  const deals = upcomingDeals(mockDeals)
  const leadsById = new Map(mockLeads.map((lead) => [lead.id, lead]))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Métricas do seu funil de vendas." />

      <MetricCards metrics={metrics} />

      <FunnelChart data={funnelData} />

      <UpcomingDealsTable deals={deals} leadsById={leadsById} />
    </div>
  )
}
