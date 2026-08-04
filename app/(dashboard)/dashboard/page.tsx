import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getDashboardMetrics, getFunnelCounts, getUpcomingDeals } from '@/lib/dashboard/queries'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCards } from '@/components/dashboard/metric-cards'
import { FunnelChart } from '@/components/dashboard/funnel-chart'
import { UpcomingDealsTable } from '@/components/dashboard/upcoming-deals-table'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) {
    redirect('/onboarding')
  }

  const [metrics, funnelData, upcomingDeals] = await Promise.all([
    getDashboardMetrics(membership.workspace_id),
    getFunnelCounts(membership.workspace_id),
    getUpcomingDeals(membership.workspace_id),
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
