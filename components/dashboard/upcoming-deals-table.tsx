import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { dealStageLabels } from '@/lib/deals/types'
import type { UpcomingDeal } from '@/lib/dashboard/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/deals/metrics'

function dueDateInfo(dueDate: string) {
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0) {
    const label = diffDays === -1 ? 'atrasado há 1 dia' : `atrasado há ${-diffDays} dias`
    return { label, className: 'text-destructive' }
  }
  if (diffDays === 0)
    return { label: 'vence hoje', className: 'text-amber-500 dark:text-amber-400' }
  if (diffDays <= 3) {
    const label = diffDays === 1 ? 'vence em 1 dia' : `vence em ${diffDays} dias`
    return { label, className: 'text-amber-500 dark:text-amber-400' }
  }
  return { label: `vence em ${diffDays} dias`, className: 'text-muted-foreground' }
}

export function UpcomingDealsTable({ deals }: { deals: UpcomingDeal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Negócios mais próximos do prazo</CardTitle>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nenhum negócio em aberto"
            description="Assim que você criar negócios no pipeline, os prazos mais próximos aparecem aqui."
          >
            <Button
              variant="outline"
              render={<Link href="/kanban">Ir para o pipeline</Link>}
            />
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Negócio</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => {
                const due = deal.due_date ? dueDateInfo(deal.due_date) : null
                return (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{deal.title}</span>
                        {deal.lead_company && (
                          <span className="text-muted-foreground text-xs">
                            {deal.lead_company}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{dealStageLabels[deal.stage]}</Badge>
                    </TableCell>
                    <TableCell>{formatBRL(deal.value)}</TableCell>
                    <TableCell>{deal.owner_name ?? 'Sem responsável'}</TableCell>
                    <TableCell className={cn('font-medium', due?.className)}>
                      {due?.label ?? 'Sem prazo'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
