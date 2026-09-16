import { contarAbertosSemValor, getFunnelCounts } from '@/lib/dashboard/queries'
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
  // As duas em paralelo: são independentes, e em série a segunda esperaria a
  // primeira sem motivo — o painel inteiro já é um boundary de Suspense.
  const [data, abertosSemValor] = await Promise.all([
    getFunnelCounts(workspaceId, periodo),
    contarAbertosSemValor(workspaceId, periodo),
  ])

  return <FunnelChart data={data} abertosSemValor={abertosSemValor} />
}
