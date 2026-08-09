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

// Devolve `null` sempre que não há prazo confiável para mostrar — quem chama
// exibe "Sem prazo". Antes a função aceitava qualquer string e calculava em
// cima do que `new Date()` devolvesse, o que produzia dois defeitos visíveis:
//
// 1) String vazia ou fora do formato vira `Invalid Date`, e todo o cálculo
//    vira `NaN` — a célula mostrava "vence em NaN dias".
// 2) Ano de dois dígitos ou zerado ("0026-08-09") é remapeado por
//    `new Date(ano, ...)` para 1900+ano, e a diferença virava dezenas de
//    milhares de dias: o famoso "atrasado há 46.000 dias".
//
// A validação abaixo cobre os dois, mais data que não existe no calendário
// (31/02, que o Date silenciosamente empurra para março).
function dueDateInfo(dueDate: string | null | undefined) {
  if (!dueDate) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate.trim())
  if (!match) return null

  const ano = Number(match[1])
  const mes = Number(match[2])
  const dia = Number(match[3])

  // Constrói em horário local de propósito: `due_date` é `date` no Postgres
  // (sem fuso), e `new Date('2026-08-09')` seria interpretado como meia-noite
  // UTC — em UTC-3 isso desloca a comparação contra a meia-noite local.
  const due = new Date(ano, mes - 1, dia)

  const dataReal =
    due.getFullYear() === ano && due.getMonth() === mes - 1 && due.getDate() === dia
  if (!dataReal) return null

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
          <>
            {/* Mesmos dados em cards abaixo de `lg`: cinco colunas com
                `whitespace-nowrap` só cabem quando o sidebar não divide a tela. */}
            <ul className="divide-y lg:hidden">
              {deals.map((deal) => {
                const due = dueDateInfo(deal.due_date)
                return (
                  <li key={deal.id} className="flex flex-col gap-2 py-3 first:pt-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{deal.title}</span>
                        {deal.lead_company && (
                          <span className="text-muted-foreground truncate text-xs">
                            {deal.lead_company}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-medium">
                        {formatBRL(deal.value)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="secondary">{dealStageLabels[deal.stage]}</Badge>
                      <span className={cn('font-medium', due?.className)}>
                        {due?.label ?? 'Sem prazo'}
                      </span>
                      <span className="text-muted-foreground">
                        · {deal.owner_name ?? 'Sem responsável'}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="hidden lg:block">
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
                    const due = dueDateInfo(deal.due_date)
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
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
