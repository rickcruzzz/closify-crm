import { cn } from '@/lib/utils'
import { dealStageLabels, type Deal } from '@/lib/deals/types'
import type { Lead } from '@/lib/leads/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

const TODAY = new Date('2026-08-02')

function dueDateInfo(dueDate: string) {
  const due = new Date(dueDate)
  const diffDays = Math.round((due.getTime() - TODAY.getTime()) / 86_400_000)

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

export function UpcomingDealsTable({
  deals,
  leadsById,
}: {
  deals: Deal[]
  leadsById: Map<string, Lead>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Negócios mais próximos do prazo</CardTitle>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum negócio em aberto.</p>
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
                const lead = leadsById.get(deal.leadId)
                const due = dueDateInfo(deal.dueDate)
                return (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{deal.title}</span>
                        {lead && (
                          <span className="text-muted-foreground text-xs">
                            {lead.company}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{dealStageLabels[deal.stage]}</Badge>
                    </TableCell>
                    <TableCell>{formatBRL(deal.value)}</TableCell>
                    <TableCell>{deal.owner}</TableCell>
                    <TableCell className={cn('font-medium', due.className)}>
                      {due.label}
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
