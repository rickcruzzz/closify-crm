import { Briefcase, DollarSign, Target, Users, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCompactBRL } from '@/lib/deals/metrics'
import type { DashboardMetrics } from '@/lib/dashboard/queries'

type MetricCardConfig = {
  label: string
  icon: LucideIcon
  accent: { text: string; bg: string }
  format: (metrics: DashboardMetrics) => string
}

// Sem histórico de métricas por período no schema ainda, não há como
// calcular variação real (ex: "+18% vs mês anterior") — mostrar um número
// inventado ao lado de dados reais seria mais enganoso do que não mostrar
// nada. Fica pendente até existir uma tabela de snapshots mensais.
const cards: MetricCardConfig[] = [
  {
    label: 'Total de Leads',
    icon: Users,
    accent: {
      text: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-500/10 dark:bg-blue-400/10',
    },
    format: (metrics) => metrics.totalLeads.toString(),
  },
  {
    label: 'Negócios Abertos',
    icon: Briefcase,
    accent: {
      text: 'text-violet-500 dark:text-violet-400',
      bg: 'bg-violet-500/10 dark:bg-violet-400/10',
    },
    format: (metrics) => metrics.openDeals.toString(),
  },
  {
    label: 'Valor do Pipeline',
    icon: DollarSign,
    accent: {
      text: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    },
    format: (metrics) => formatCompactBRL(metrics.pipelineValue),
  },
  {
    label: 'Taxa de Conversão',
    icon: Target,
    accent: {
      text: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
    },
    format: (metrics) => `${metrics.conversionRate.toFixed(0)}%`,
  },
]

export function MetricCards({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {card.label}
            </CardTitle>
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                card.accent.bg,
              )}
            >
              <card.icon className={cn('size-4.5', card.accent.text)} />
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{card.format(metrics)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
