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
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { dealStageLabels, dealStages, type DealStage } from '@/lib/deals/types'
import { createDeal, updateDealStage } from '@/lib/deals/actions'
import type { DealLeadRow, DealRow } from '@/lib/deals/queries'
import type { WorkspaceMember } from '@/lib/leads/queries'
import type { DealFormValues } from '@/lib/validations/deal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { KanbanColumn } from '@/components/kanban/kanban-column'
import { DealCardOverlay } from '@/components/kanban/deal-card-overlay'
import { DealDetailSheet } from '@/components/kanban/deal-detail-sheet'
import { DealFormDialog } from '@/components/kanban/deal-form-dialog'

export function KanbanBoard({
  initialDeals,
  leads,
  members,
}: {
  initialDeals: DealRow[]
  leads: DealLeadRow[]
  members: WorkspaceMember[]
}) {
  const [deals, setDeals] = React.useState(initialDeals)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [selectedDealId, setSelectedDealId] = React.useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [ownerFilter, setOwnerFilter] = React.useState('todos')

  React.useEffect(() => {
    setDeals(initialDeals)
  }, [initialDeals])

  const leadsById = React.useMemo(
    () => new Map(leads.map((lead) => [lead.id, lead])),
    [leads],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const dealId = String(active.id)
    const finalStage = stageOf(String(over.id))
    const startStage = dragStartStage.current
    dragStartStage.current = null

    if (!finalStage || finalStage === startStage) return

    // Update otimista já aplicado no dragOver — se a Server Action falhar,
    // desfaz para o estado anterior em vez de deixar a UI mentir sobre o
    // que está persistido no banco.
    const result = await updateDealStage(dealId, finalStage)
    if (result?.error) {
      toast.error(result.error)
      setDeals((prev) =>
        prev.map((deal) => (deal.id === dealId ? { ...deal, stage: startStage! } : deal)),
      )
      return
    }

    toast.success(`Negócio movido para ${dealStageLabels[finalStage]}`)
  }

  async function handleStageChange(dealId: string, stage: DealStage) {
    const previousStage = deals.find((deal) => deal.id === dealId)?.stage
    setDeals((prev) =>
      prev.map((deal) => (deal.id === dealId ? { ...deal, stage } : deal)),
    )

    const result = await updateDealStage(dealId, stage)
    if (result?.error) {
      toast.error(result.error)
      if (previousStage) {
        setDeals((prev) =>
          prev.map((deal) =>
            deal.id === dealId ? { ...deal, stage: previousStage } : deal,
          ),
        )
      }
      return
    }

    toast.success(`Negócio movido para ${dealStageLabels[stage]}`)
  }

  async function handleCreateDeal(values: DealFormValues) {
    const result = await createDeal(values)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Negócio criado com sucesso.')
  }

  const selectedDeal = deals.find((deal) => deal.id === selectedDealId)
  const activeDeal = deals.find((deal) => deal.id === activeId)

  const hasActiveFilters = search.trim() !== '' || ownerFilter !== 'todos'

  // Filtra só o que é renderizado. O drag-and-drop continua operando sobre
  // `deals` (estado completo), então update otimista e rollback não mudam.
  const filteredDeals = React.useMemo(() => {
    const term = search.trim().toLowerCase()

    return deals.filter((deal) => {
      if (ownerFilter !== 'todos' && deal.owner_id !== ownerFilter) return false
      if (!term) return true

      const lead = deal.lead_id ? leadsById.get(deal.lead_id) : undefined
      return (
        deal.title.toLowerCase().includes(term) ||
        !!lead?.name.toLowerCase().includes(term) ||
        !!lead?.company?.toLowerCase().includes(term)
      )
    })
  }, [deals, leadsById, ownerFilter, search])

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 lg:flex-row">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar por negócio, lead ou empresa..."
              aria-label="Buscar negócios"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select
            value={ownerFilter}
            onValueChange={(value) => setOwnerFilter(value ?? 'todos')}
          >
            <SelectTrigger
              className="w-full lg:w-56"
              aria-label="Filtrar por responsável"
            >
              <SelectValue>
                {(value) =>
                  value === 'todos'
                    ? 'Todos os responsáveis'
                    : (members.find((m) => m.id === value)?.name ??
                      'Todos os responsáveis')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setIsFormOpen(true)} className="shrink-0">
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
        {/* Margem negativa + padding devolvem a faixa de scroll até a borda da
            viewport: sem isso as colunas eram cortadas pelo padding do `main`
            no mobile. O snap é só abaixo de `sm`, porque acima disso o board
            inteiro cabe e o snap só atrapalharia o auto-scroll do drag. */}
        <div className="-mx-4 flex snap-x snap-proximity scroll-pl-4 gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:snap-none md:-mx-6 md:scroll-pl-6 md:px-6">
          {dealStages.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              deals={filteredDeals.filter((deal) => deal.stage === stage)}
              leadsById={leadsById}
              onOpenDeal={setSelectedDealId}
              filtered={hasActiveFilters}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <DealCardOverlay
              deal={activeDeal}
              lead={activeDeal.lead_id ? leadsById.get(activeDeal.lead_id) : undefined}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <DealDetailSheet
        deal={selectedDeal}
        lead={selectedDeal?.lead_id ? leadsById.get(selectedDeal.lead_id) : undefined}
        open={!!selectedDealId}
        onOpenChange={(open) => !open && setSelectedDealId(null)}
        onStageChange={handleStageChange}
      />

      <DealFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onCreate={handleCreateDeal}
        leads={leads}
        members={members}
      />
    </>
  )
}
