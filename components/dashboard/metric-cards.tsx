import Link from 'next/link'
import { ArrowRight, Briefcase, DollarSign, Target, Users, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCompactBRL } from '@/lib/deals/metrics'
import type { DashboardMetrics } from '@/lib/dashboard/queries'

type MetricCardConfig = {
  label: string
  icon: LucideIcon
  accent: { text: string; bg: string }
  format: (metrics: DashboardMetrics) => string
  /** Só os dois cards que têm pra onde ir de verdade ganham link. */
  href?: string
  hrefLabel?: string
}

// Sem histórico de métricas por período no schema ainda, não há como
// calcular variação real (ex: "+18% vs mês anterior"), mostrar um número
// inventado ao lado de dados reais seria mais enganoso do que não mostrar
// nada. Fica pendente até existir uma tabela de snapshots mensais.
const cards: MetricCardConfig[] = [
  {
    label: 'Contatos',
    icon: Users,
    accent: {
      text: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-500/10 dark:bg-blue-400/10',
    },
    format: (metrics) => metrics.totalLeads.toString(),
    href: '/leads',
    hrefLabel: 'Ver contatos',
  },
  {
    label: 'Negócios abertos',
    icon: Briefcase,
    accent: {
      text: 'text-violet-500 dark:text-violet-400',
      bg: 'bg-violet-500/10 dark:bg-violet-400/10',
    },
    format: (metrics) => metrics.openDeals.toString(),
  },
  {
    label: 'Valor no funil',
    icon: DollarSign,
    accent: {
      text: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    },
    format: (metrics) => formatCompactBRL(metrics.pipelineValue),
  },
  {
    label: 'Viraram venda',
    icon: Target,
    accent: {
      text: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
    },
    format: (metrics) => `${metrics.conversionRate.toFixed(0)}%`,
    // Não existe tela própria de detalhamento de conversão (ganho/perdido
    // por período) ainda, o Kanban já mostra as colunas Fechado Ganho e
    // Fechado Perdido lado a lado, que é o dado por trás do percentual.
    // Reaproveita em vez de construir uma tela nova só pra isso.
    href: '/kanban',
    hrefLabel: 'Ver no funil',
  },
]

export function MetricCards({ metrics }: { metrics: DashboardMetrics }) {
  // Workspace sem nenhum lead: quatro zeros não informam nada e ainda dão a
  // impressão de sistema quebrado. Um convite à ação ocupa o mesmo espaço e
  // diz o que fazer. Basta o primeiro lead para os cartões voltarem, e eles
  // voltam com número de verdade, não com zero.
  if (metrics.totalLeads === 0 && metrics.openDeals === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={Target}
            title="Seu funil está pronto"
            description="Cadastre o primeiro contato para começar a acompanhar suas oportunidades. Os números aparecem aqui assim que houver movimento."
          >
            <Button render={<Link href="/leads">Adicionar primeiro contato</Link>} />
            <Button
              variant="outline"
              render={<Link href="/kanban">Ver o funil</Link>}
            />
          </EmptyState>
        </CardContent>
      </Card>
    )
  }

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
          <CardContent className="flex flex-col gap-1">
            <span className="text-2xl font-semibold">{card.format(metrics)}</span>
            {card.href && (
              <Link
                href={card.href}
                className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs transition-colors"
              >
                {card.hrefLabel}
                <ArrowRight aria-hidden className="size-3" />
              </Link>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
