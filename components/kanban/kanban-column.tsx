import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { cn } from '@/lib/utils'
import { dealStageLabels, type DealStage } from '@/lib/deals/types'
import type { DealRow, DealLeadRow } from '@/lib/deals/queries'
import type { ProximaAcaoRow } from '@/lib/tasks/types'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DealCard } from '@/components/kanban/deal-card'
import { EmptyColumnState } from '@/components/kanban/empty-column-state'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function KanbanColumn({
  stage,
  deals,
  leadsById,
  proximaAcaoPorNegocio,
  onOpenDeal,
  filtered = false,
  compact = false,
}: {
  stage: DealStage
  deals: DealRow[]
  leadsById: Map<string, DealLeadRow>
  /** Tarefa aberta mais próxima de cada negócio, resolvida uma vez no servidor. */
  proximaAcaoPorNegocio: Map<string, ProximaAcaoRow>
  onOpenDeal: (dealId: string) => void
  filtered?: boolean
  /** Board inteiro sem nenhum negócio: encolhe a coluna. */
  compact?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } })
  const total = deals.reduce((sum, deal) => sum + deal.value, 0)

  return (
    <div className="w-72 shrink-0 snap-start">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{dealStageLabels[stage]}</span>
          <Badge variant="secondary">{deals.length}</Badge>
        </div>
        <span className="text-muted-foreground text-xs font-medium">
          {formatBRL(total)}
        </span>
      </div>

      {/* `dvh` em vez de `vh`: no iOS/Android a barra de URL entra e sai do
          viewport e `100vh` deixa o fim da coluna abaixo da dobra. O desconto
          é maior abaixo de `lg` porque a barra de filtros empilha em três
          linhas — o mesmo breakpoint usado em `kanban-board`.

          Com o board vazio a coluna encolhe: o guia de primeiros passos ocupa
          espaço acima, e manter altura cheia jogaria colunas vazias para baixo
          da dobra sem nada dentro. */}
      <ScrollArea
        className={cn(
          compact ? 'h-36' : 'h-[calc(100dvh-22rem)] min-h-64 lg:h-[calc(100dvh-18rem)]',
        )}
      >
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
              <EmptyColumnState filtered={filtered} />
            ) : (
              deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  lead={deal.lead_id ? leadsById.get(deal.lead_id) : undefined}
                  proximaAcao={proximaAcaoPorNegocio.get(deal.id)}
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
