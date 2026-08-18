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
import { AlarmClock, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { dealStageLabels, dealStages, type DealStage } from '@/lib/deals/types'
import { estadoDeMovimento } from '@/lib/deals/parado'
import { createDeal, updateDealStage } from '@/lib/deals/actions'
import type { DealLeadRow, DealRow } from '@/lib/deals/queries'
import type { WorkspaceMember } from '@/lib/leads/queries'
import type { DealFormValues } from '@/lib/validations/deal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { KanbanColumn } from '@/components/kanban/kanban-column'
import { DealCardOverlay } from '@/components/kanban/deal-card-overlay'
import type { ProximaAcaoRow } from '@/lib/tasks/types'
import { DealDetailSheet } from '@/components/kanban/deal-detail-sheet'
import { DealFormDialog } from '@/components/kanban/deal-form-dialog'

// Comparação rasa: DealRow (lib/deals/queries.ts) só tem campos primitivos.
function dealsIguais(a: DealRow, b: DealRow) {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.lead_id === b.lead_id &&
    a.value === b.value &&
    a.stage === b.stage &&
    a.due_date === b.due_date &&
    a.created_at === b.created_at &&
    a.stage_changed_at === b.stage_changed_at &&
    a.owner_id === b.owner_id &&
    a.owner_name === b.owner_name
  )
}

export function KanbanBoard({
  initialDeals,
  totalPorEtapa,
  leads,
  members,
  currentUserId,
  proximasAcoes,
  calendarConectado,
}: {
  initialDeals: DealRow[]
  /**
   * Quantos negócios cada etapa tem no banco.
   *
   * O board carrega no máximo 200 por etapa (0032). Sem este número a coluna
   * não teria como avisar que há mais, e cortar calado é justamente o defeito
   * que o teto explícito veio substituir.
   */
  totalPorEtapa: Record<DealStage, number>
  leads: DealLeadRow[]
  members: WorkspaceMember[]
  /** Responsável padrão da tarefa agendada pelo painel do negócio. */
  currentUserId: string
  /**
   * A tarefa aberta mais próxima de cada negócio, em pares [dealId, tarefa].
   *
   * Chega como array e não como `Map` porque o servidor serializa a prop antes
   * de mandar para o cliente, e `Map` não sobrevive a essa travessia.
   */
  proximasAcoes: [string, ProximaAcaoRow][]
  /** Se dá pra oferecer "mandar pro Google Calendar" no painel do negócio. */
  calendarConectado: boolean
}) {
  const [deals, setDeals] = React.useState(initialDeals)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [selectedDealId, setSelectedDealId] = React.useState<string | null>(null)
  /**
   * Abrir o painel já no agendamento, quando veio do aviso do card.
   *
   * Sem isto, clicar em "Sem próximo passo" abriria o painel e a pessoa ainda
   * teria que achar o botão de agendar lá dentro. O aviso existe justamente
   * porque ela não está agendando; cobrar mais um passo é pedir para o número
   * continuar onde está (96% dos negócios abertos sem próxima ação).
   */
  const [abrirAgendamento, setAbrirAgendamento] = React.useState(false)

  const abrirDealNoAgendamento = React.useCallback((dealId: string) => {
    setSelectedDealId(dealId)
    setAbrirAgendamento(true)
  }, [])
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [ownerFilter, setOwnerFilter] = React.useState('todos')
  const [soParados, setSoParados] = React.useState(false)

  // Relógio único e do CLIENTE: o servidor da Vercel roda em UTC, e "parado há
  // N dias" calculado lá erraria a virada do dia.
  const [agora, setAgora] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setAgora(new Date())
  }, [])

  // Merge seletivo, não substituição: `initialDeals` chega como um array
  // NOVO (o servidor recria todo DealRow) toda vez que '/kanban' revalida,
  // inclusive por um updateDealStage que o próprio board acabou de disparar.
  // Trocar a referência de TODO negócio aqui derrubaria o React.memo de
  // DealCard/KanbanColumn e causaria um segundo re-render do board inteiro,
  // agora alguns instantes depois de soltar o card. Preservando a referência
  // de quem não mudou, só quem foi de fato alterado (por esta aba ou por
  // outra) perde a memoização.
  React.useEffect(() => {
    setDeals((atual) => {
      const porId = new Map(atual.map((deal) => [deal.id, deal]))
      let mudou = atual.length !== initialDeals.length
      const proximo = initialDeals.map((novo) => {
        const anterior = porId.get(novo.id)
        if (anterior && dealsIguais(anterior, novo)) return anterior
        mudou = true
        return novo
      })
      return mudou ? proximo : atual
    })
  }, [initialDeals])

  const leadsById = React.useMemo(
    () => new Map(leads.map((lead) => [lead.id, lead])),
    [leads],
  )

  const proximaAcaoPorNegocio = React.useMemo(
    () => new Map(proximasAcoes),
    [proximasAcoes],
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

    // Update otimista já aplicado no dragOver, se a Server Action falhar,
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

    avisarMovido(dealId, finalStage)
  }

  /**
   * Confirma o movimento e, se o negócio ficou sem próximo passo, oferece
   * agendar ali mesmo.
   *
   * Mover de etapa é exatamente o instante em que a pessoa sabe o que vem
   * depois: acabou a ligação, mandou a proposta. Se a oferta não aparece
   * agora, ela some, e o negócio entra na estatística de 96% sem próxima ação
   * medida em produção.
   *
   * Toast com ação, não um diálogo que interrompe: quem está arrastando cinco
   * cards seguidos não pode ser parado a cada um. Quem quiser, clica; quem não
   * quiser, o aviso some sozinho.
   */
  function avisarMovido(dealId: string, stage: DealStage) {
    const mensagem = `Negócio movido para ${dealStageLabels[stage]}`

    if (proximaAcaoPorNegocio.has(dealId)) {
      toast.success(mensagem)
      return
    }

    toast.success(mensagem, {
      description: 'Sem próximo passo marcado.',
      action: {
        label: 'Agendar',
        onClick: () => abrirDealNoAgendamento(dealId),
      },
    })
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

    avisarMovido(dealId, stage)
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

  const hasActiveFilters = search.trim() !== '' || ownerFilter !== 'todos' || soParados

  // Contado sobre `deals`, não sobre o filtrado: o botão precisa dizer quantos
  // existem, inclusive quando o próprio filtro está ligado.
  const quantosParados = React.useMemo(() => {
    if (!agora) return 0
    return deals.filter((d) => estadoDeMovimento(d, agora).parado).length
  }, [deals, agora])

  // Filtra só o que é renderizado. O drag-and-drop continua operando sobre
  // `deals` (estado completo), então update otimista e rollback não mudam.
  const filteredDeals = React.useMemo(() => {
    const term = search.trim().toLowerCase()

    return deals.filter((deal) => {
      if (ownerFilter !== 'todos' && deal.owner_id !== ownerFilter) return false
      if (soParados && !(agora && estadoDeMovimento(deal, agora).parado)) return false
      if (!term) return true

      const lead = deal.lead_id ? leadsById.get(deal.lead_id) : undefined
      return (
        deal.title.toLowerCase().includes(term) ||
        !!lead?.name.toLowerCase().includes(term) ||
        !!lead?.company?.toLowerCase().includes(term)
      )
    })
  }, [deals, leadsById, ownerFilter, search, soParados, agora])

  // Uma passagem só, em vez de `filteredDeals.filter(...)` repetido inline
  // por coluna (6 varreduras completas do array a cada render do board).
  const dealsPorEtapa = React.useMemo(() => {
    const grupos = new Map<DealStage, DealRow[]>(dealStages.map((stage) => [stage, []]))
    for (const deal of filteredDeals) {
      grupos.get(deal.stage)?.push(deal)
    }
    return grupos
  }, [filteredDeals])

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

          {/* Só aparece quando há negócio parado de verdade. Um botão que
              nunca acende ocupa espaço e ensina a pessoa a ignorá-lo, e num
              funil saudável ele deve mesmo ficar escondido. */}
          {quantosParados > 0 && (
            <Button
              type="button"
              variant={soParados ? 'default' : 'outline'}
              aria-pressed={soParados}
              onClick={() => setSoParados((v) => !v)}
              className="shrink-0"
            >
              <AlarmClock className="size-4" />
              Parados
              <Badge variant={soParados ? 'secondary' : 'destructive'}>
                {quantosParados}
              </Badge>
            </Button>
          )}
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
              deals={dealsPorEtapa.get(stage) ?? []}
              leadsById={leadsById}
              proximaAcaoPorNegocio={proximaAcaoPorNegocio}
              totalNaEtapa={totalPorEtapa[stage] ?? 0}
              onOpenDeal={setSelectedDealId}
              onAgendarDeal={abrirDealNoAgendamento}
              filtered={hasActiveFilters}
              // `deals`, não `filteredDeals`: quem filtrou até zerar a tela
              // tem board com conteúdo, e a coluna deve manter a altura.
              compact={deals.length === 0}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <DealCardOverlay
              deal={activeDeal}
              lead={activeDeal.lead_id ? leadsById.get(activeDeal.lead_id) : undefined}
              proximaAcao={proximaAcaoPorNegocio.get(activeDeal.id)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <DealDetailSheet
        deal={selectedDeal}
        lead={selectedDeal?.lead_id ? leadsById.get(selectedDeal.lead_id) : undefined}
        proximaAcao={selectedDeal ? proximaAcaoPorNegocio.get(selectedDeal.id) : undefined}
        members={members}
        currentUserId={currentUserId}
        calendarConectado={calendarConectado}
        open={!!selectedDealId}
        abrirAgendamento={abrirAgendamento}
        onAgendamentoAberto={() => setAbrirAgendamento(false)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDealId(null)
            // Sem zerar aqui, reabrir o mesmo negócio pelo card
            // cairia no agendamento de novo, sem ninguém ter pedido.
            setAbrirAgendamento(false)
          }
        }}
        onStageChange={handleStageChange}
        // Tira o card na hora. A action já revalida no servidor, mas esperar o
        // round-trip deixaria o negócio visível no funil por um instante
        // depois de a pessoa confirmar a exclusão.
        onDeleted={(dealId) => {
          setDeals((atual) => atual.filter((d) => d.id !== dealId))
          setSelectedDealId(null)
        }}
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
