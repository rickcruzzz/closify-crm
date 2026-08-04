import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { cn } from '@/lib/utils'
import { dealStageLabels, type DealStage } from '@/lib/deals/types'
import type { DealRow, DealLeadRow } from '@/lib/deals/queries'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DealCard } from '@/components/kanban/deal-card'
import { EmptyColumnState } from '@/components/kanban/empty-column-state'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function KanbanColumn({
  stage,
  deals,
  leadsById,
  onOpenDeal,
}: {
  stage: DealStage
  deals: DealRow[]
  leadsById: Map<string, DealLeadRow>
  onOpenDeal: (dealId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } })
  const total = deals.reduce((sum, deal) => sum + deal.value, 0)

  return (
    <div className="w-72 shrink-0">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{dealStageLabels[stage]}</span>
          <Badge variant="secondary">{deals.length}</Badge>
        </div>
        <span className="text-muted-foreground text-xs font-medium">{formatBRL(total)}</span>
      </div>

      <ScrollArea className="h-[calc(100vh-14rem)]">
        <div
          ref={setNodeRef}
          className={cn(
            'flex min-h-[120px] flex-col gap-2 rounded-lg p-1 transition-colors',
            isOver && 'ring-primary/40 bg-muted/40 ring-2',
          )}
        >
          <SortableContext
            items={deals.map((deal) => deal.id)}
            strategy={verticalListSortingStrategy}
          >
            {deals.length === 0 ? (
              <EmptyColumnState />
            ) : (
              deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  lead={deal.lead_id ? leadsById.get(deal.lead_id) : undefined}
                  onOpen={onOpenDeal}
                />
              ))
            )}
          </SortableContext>
        </div>
      </ScrollArea>
    </div>
  )
}
