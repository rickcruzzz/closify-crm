import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardMetrics } from '@/lib/deals/metrics'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function MetricCards({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    { label: 'Total de Leads', value: metrics.totalLeads.toString() },
    { label: 'Negócios Abertos', value: metrics.openDeals.toString() },
    { label: 'Valor do Pipeline', value: formatBRL(metrics.pipelineValue) },
    { label: 'Taxa de Conversão', value: `${metrics.conversionRate.toFixed(0)}%` },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{card.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
