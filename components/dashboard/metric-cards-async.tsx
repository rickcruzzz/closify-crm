import { getDashboardMetrics } from '@/lib/dashboard/queries'
import type { PeriodoDoDashboard } from '@/lib/dashboard/queries'
import { MetricCards } from '@/components/dashboard/metric-cards'

/**
 * Wrapper `async` fino para dar a `MetricCards` seu próprio Suspense boundary.
 *
 * O dashboard tinha 5 queries no MESMO `Promise.all` da página inteira, então
 * a tela ficava em branco até a mais lenta terminar — mesmo que os cards de
 * métrica (a query mais rápida) já estivessem prontos há muito tempo. Cada
 * painel vira seu componente `async` próprio; o React 19/Next App Router
 * transmite (streaming) cada um assim que resolve, em vez de esperar todos.
 */
export async function MetricCardsAsync({
  workspaceId,
  periodo,
}: {
  workspaceId: string
  periodo?: PeriodoDoDashboard
}) {
  const metrics = await getDashboardMetrics(workspaceId, periodo)
  // `periodo` ausente significa "todo o histórico", que é o padrão da tela.
  // `MetricCards` precisa dessa distinção para não mandar uma empresa com 200
  // contatos "cadastrar o primeiro" só porque ela filtrou por Hoje.
  return <MetricCards metrics={metrics} temFiltroDePeriodo={periodo !== undefined} />
}
