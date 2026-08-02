import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { cn } from '@/lib/utils'
import type { Deal, DealStage } from '@/lib/deals/types'
import type { Lead } from '@/lib/leads/types'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const stageAccent: Record<DealStage, string> = {
  novo: 'border-l-blue-500 dark:border-l-blue-400',
  contato_realizado: 'border-l-amber-500 dark:border-l-amber-400',
  proposta_enviada: 'border-l-violet-500 dark:border-l-violet-400',
  negociacao: 'border-l-orange-500 dark:border-l-orange-400',
  fechado_ganho: 'border-l-emerald-500 dark:border-l-emerald-400',
  fechado_perdido: 'border-l-red-500 dark:border-l-red-400',
}

const TODAY = new Date('2026-08-02')

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dueDateInfo(dueDate: string) {
  const due = new Date(dueDate)
  const diffDays = Math.round((due.getTime() - TODAY.getTime()) / 86_400_000)

  if (diffDays < 0) {
    const label = diffDays === -1 ? 'atrasado há 1 dia' : `atrasado há ${-diffDays} dias`
    return { label, className: 'text-destructive' }
  }
  if (diffDays === 0) {
    return { label: 'vence hoje', className: 'text-amber-500 dark:text-amber-400' }
  }
  if (diffDays <= 3) {
    const label = diffDays === 1 ? 'vence em 1 dia' : `vence em ${diffDays} dias`
    return { label, className: 'text-amber-500 dark:text-amber-400' }
  }
  const label = `vence em ${diffDays} dias`
  return { label, className: 'text-muted-foreground' }
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function DealCard({
  deal,
  lead,
  onOpen,
}: {
  deal: Deal
  lead: Lead | undefined
  onOpen: (dealId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: deal.id,
      data: { stage: deal.stage },
    })

  const due = dueDateInfo(deal.dueDate)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={() => onOpen(deal.id)}
      {...attributes}
      {...listeners}
    >
      <Card
        size="sm"
        className={cn(
          'cursor-grab border-l-2 active:cursor-grabbing',
          stageAccent[deal.stage],
          isDragging && 'opacity-40',
        )}
      >
        <CardContent className="flex flex-col gap-1.5">
          <span className="text-base font-semibold">{formatBRL(deal.value)}</span>
          <div className="flex flex-col">
            <span className="truncate text-sm">{deal.title}</span>
            {lead && (
              <span className="text-muted-foreground truncate text-xs">
                {lead.company}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <Avatar size="sm">
              <AvatarFallback>{initials(deal.owner)}</AvatarFallback>
            </Avatar>
            <span className={cn('text-xs font-medium whitespace-nowrap', due.className)}>
              {due.label}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
