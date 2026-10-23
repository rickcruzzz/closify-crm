import { getDashboardMetrics } from '@/lib/dashboard/queries'
import type { PeriodoDoDashboard } from '@/lib/dashboard/queries'
import { janelaAnterior } from '@/lib/dashboard/variacao'
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
  compacto = false,
}: {
  workspaceId: string
  periodo?: PeriodoDoDashboard
  compacto?: boolean
}) {
  const anterior = janelaAnterior(periodo ?? null)

  // A segunda chamada existe SÓ quando há período escolhido, e é o custo
  // inteiro da comparação: nenhuma tabela de snapshot, nenhuma coluna nova.
  // Sem período, `anterior` é `null` e o dashboard faz exatamente o mesmo
  // número de consultas de antes de 16/09.
  const [metrics, metricsAnteriores] = await Promise.all([
    getDashboardMetrics(workspaceId, periodo),
    anterior ? getDashboardMetrics(workspaceId, anterior) : Promise.resolve(null),
  ])

  // `periodo` ausente significa "todo o histórico", que é o padrão da tela.
  // `MetricCards` precisa dessa distinção para não mandar uma empresa com 200
  // contatos "cadastrar o primeiro" só porque ela filtrou por Hoje.
  return (
    <MetricCards
      metrics={metrics}
      anteriores={metricsAnteriores}
      temFiltroDePeriodo={periodo !== undefined}
      compacto={compacto}
    />
  )
}
