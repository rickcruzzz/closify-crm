'use client'

import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { dealStageLabels, dealStages, type Deal, type DealStage } from '@/lib/deals/types'
import { mockDeals } from '@/lib/deals/mock-data'
import { mockLeads } from '@/lib/leads/mock-data'
import type { DealFormValues } from '@/lib/validations/deal'
import { Button } from '@/components/ui/button'
import { KanbanColumn } from '@/components/kanban/kanban-column'
import { KanbanSkeleton } from '@/components/kanban/kanban-skeleton'
import { DealCardOverlay } from '@/components/kanban/deal-card-overlay'
import { DealDetailSheet } from '@/components/kanban/deal-detail-sheet'
import { DealFormDialog } from '@/components/kanban/deal-form-dialog'

let nextDealId = mockDeals.length + 1

export function KanbanBoard() {
  const [isLoading, setIsLoading] = React.useState(true)
  const [deals, setDeals] = React.useState(mockDeals)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [selectedDealId, setSelectedDealId] = React.useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = React.useState(false)

  const leadsById = React.useMemo(
    () => new Map(mockLeads.map((lead) => [lead.id, lead])),
    [],
  )

  React.useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timeout)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const dragStartStage = React.useRef<DealStage | null>(null)

  function stageOf(id: string): DealStage | undefined {
    if (dealStages.includes(id as DealStage)) return id as DealStage
    return deals.find((deal) => deal.id === id)?.stage
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveId(id)
    dragStartStage.current = deals.find((deal) => deal.id === id)?.stage ?? null
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeStage = stageOf(String(active.id))
    const overStage = stageOf(String(over.id))
    if (!activeStage || !overStage || activeStage === overStage) return

    setDeals((prev) =>
      prev.map((deal) => (deal.id === active.id ? { ...deal, stage: overStage } : deal)),
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeIndex = deals.findIndex((deal) => deal.id === active.id)
    const overIndex = deals.findIndex((deal) => deal.id === over.id)

    if (activeIndex === -1) return

    if (overIndex !== -1 && active.id !== over.id) {
      setDeals((prev) => arrayMove(prev, activeIndex, overIndex))
    }

    const finalStage = stageOf(String(over.id))
    if (finalStage && finalStage !== dragStartStage.current) {
      toast.success(`Negócio movido para ${dealStageLabels[finalStage]}`)
    }
    dragStartStage.current = null
  }

  function handleStageChange(dealId: string, stage: DealStage) {
    setDeals((prev) =>
      prev.map((deal) => (deal.id === dealId ? { ...deal, stage } : deal)),
    )
    toast.success(`Negócio movido para ${dealStageLabels[stage]}`)
  }

  function handleCreateDeal(values: DealFormValues) {
    const newDeal: Deal = {
      id: `deal-${nextDealId++}`,
      title: values.title,
      leadId: values.leadId,
      value: values.value,
      stage: values.stage,
      owner: values.owner,
      dueDate: values.dueDate,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    setDeals((prev) => [...prev, newDeal])
    toast.success('Negócio criado com sucesso.')
  }

  const selectedDeal = deals.find((deal) => deal.id === selectedDealId)
  const activeDeal = deals.find((deal) => deal.id === activeId)

  if (isLoading) {
    return <KanbanSkeleton />
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="size-4" />
          Novo negócio
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {dealStages.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              deals={deals.filter((deal) => deal.stage === stage)}
              leadsById={leadsById}
              onOpenDeal={setSelectedDealId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <DealCardOverlay deal={activeDeal} lead={leadsById.get(activeDeal.leadId)} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <DealDetailSheet
        deal={selectedDeal}
        lead={selectedDeal ? leadsById.get(selectedDeal.leadId) : undefined}
        open={!!selectedDealId}
        onOpenChange={(open) => !open && setSelectedDealId(null)}
        onStageChange={handleStageChange}
      />

      <DealFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onCreate={handleCreateDeal}
      />
    </>
  )
}
