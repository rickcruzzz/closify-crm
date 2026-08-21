import { getFunnelCounts } from '@/lib/dashboard/queries'
import type { PeriodoDoDashboard } from '@/lib/dashboard/queries'
import { FunnelChart } from '@/components/dashboard/funnel-chart'

/** Mesmo padrão de `metric-cards-async.tsx`: Suspense boundary própria. */
export async function FunnelChartAsync({
  workspaceId,
  periodo,
}: {
  workspaceId: string
  periodo?: PeriodoDoDashboard
}) {
  const data = await getFunnelCounts(workspaceId, periodo)
  return <FunnelChart data={data} />
}
