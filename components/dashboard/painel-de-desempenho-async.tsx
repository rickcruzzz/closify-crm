import { getFunnelPerformance } from '@/lib/dashboard/queries'
import type { PeriodoDoDashboard } from '@/lib/dashboard/queries'
import { PainelDeDesempenho } from '@/components/dashboard/painel-de-desempenho'

/** Mesmo padrão dos outros três painéis: Suspense boundary própria. */
export async function PainelDeDesempenhoAsync({
  workspaceId,
  periodo,
}: {
  workspaceId: string
  periodo?: PeriodoDoDashboard
}) {
  const desempenho = await getFunnelPerformance(workspaceId, periodo)
  return <PainelDeDesempenho desempenho={desempenho} />
}
