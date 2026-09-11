'use client'

import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { AlarmClock, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { dealStageLabels, dealStages, type DealStage } from '@/lib/deals/types'
import { estadoDeMovimento } from '@/lib/deals/parado'
import { deveAplicarPreview, escolherColisao } from '@/lib/deals/arrasto'
import { createDeal, updateDealStage } from '@/lib/deals/actions'
import type { DealLeadRow, DealRow } from '@/lib/deals/queries'
import type { WorkspaceMember } from '@/lib/leads/queries'
import type { DealFormValues } from '@/lib/validations/deal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/ui/autocomplete'
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

/**
 * Colisão por ponteiro, com o canto mais próximo só quando não há ponteiro.
 *
 * Fora do componente de propósito: não depende de nada do render, e o dnd-kit
 * a chama a cada movimento do cursor. O porquê inteiro está em
 * `lib/deals/arrasto.ts` — em resumo, o padrão `rectIntersection` decide pelo
 * retângulo do card, que MUDA quando o card entra na outra coluna, e essa
 * realimentação é o laço que produzia React #185.
 */
const detectarColisao: CollisionDetection = (args) =>
  escolherColisao(pointerWithin(args), () => closestCorners(args))

export function KanbanBoard({
  initialDeals,
  totalPorEtapa,
  leads,
  members,
  currentUserId,
  proximasAcoes,
  calendarConectado,
  negocioInicial = null,
  etapaEmFoco = null,
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
  /**
   * Negócio a abrir de cara, vindo de `/kanban?negocio=<id>`.
   *
   * É o que faz uma linha de "Negócios mais próximos do prazo" abrir o
   * negócio em vez de largar a pessoa no quadro inteiro para procurá-lo.
   */
  negocioInicial?: string | null
  /**
   * Etapa a trazer para a tela, vinda de `/kanban?etapa=<stage>`.
   *
   * Clicar numa barra do funil no dashboard cai aqui. Sem isso o clique
   * levaria ao board sem foco nenhum, e em telas estreitas a coluna em que a
   * pessoa clicou nem estaria visível.
   */
  etapaEmFoco?: DealStage | null
}) {
  const [deals, setDeals] = React.useState(initialDeals)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  // Semeado pela URL: `?negocio=<id>` abre o painel já na primeira pintura,
  // sem piscar o quadro antes.
  const [selectedDealId, setSelectedDealId] = React.useState<string | null>(negocioInicial)
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
  // Estável de propósito: passada como dependência do `useEffect` de
  // `DealDetailSheet`. Uma arrow function inline seria recriada a cada
  // render deste board (que muda bastante, drag and drop), o `useEffect` só
  // não reagia a isso por causa do guard `if (!open || !abrirAgendamento)`.
  const marcarAgendamentoAberto = React.useCallback(() => setAbrirAgendamento(false), [])
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
  /**
   * A última etapa para a qual a pré-visualização já moveu o card, neste
   * arrasto.
   *
   * `ref` e não estado: o `dragOver` dispara várias vezes dentro do mesmo lote
   * do React, e ali `deals` ainda é o valor anterior. A guarda antiga lia o
   * estado e por isso deixava passar tanto a repetição quanto a alternância
   * `A -> B -> A`, que é a forma do laço de React #185.
   */
  const etapaPrevista = React.useRef<DealStage | null>(null)

  function stageOf(id: string): DealStage | undefined {
    if (dealStages.includes(id as DealStage)) return id as DealStage
    return deals.find((deal) => deal.id === id)?.stage
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveId(id)
    dragStartStage.current = deals.find((deal) => deal.id === id)?.stage ?? null
    etapaPrevista.current = null
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeStage = stageOf(String(active.id))
    const overStage = stageOf(String(over.id))

    if (
      !overStage ||
      !deveAplicarPreview({
        etapaPrevista: etapaPrevista.current,
        etapaAtual: activeStage,
        etapaAlvo: overStage,
      })
    ) {
      return
    }

    etapaPrevista.current = overStage
    setDeals((prev) =>
      prev.map((deal) => (deal.id === active.id ? { ...deal, stage: overStage } : deal)),
    )
  }

  /**
   * Põe um negócio numa etapa, preservando a referência quando ele já está lá.
   *
   * O `prev` devolvido igual faz o React descartar o render — importante aqui
   * porque este caminho é chamado no fim de todo arrasto, inclusive nos que já
   * tiveram a etapa aplicada pela pré-visualização.
   */
  function moverPara(dealId: string, stage: DealStage) {
    setDeals((prev) =>
      prev.some((deal) => deal.id === dealId && deal.stage !== stage)
        ? prev.map((deal) => (deal.id === dealId ? { ...deal, stage } : deal))
        : prev,
    )
  }

  /**
   * Arrasto abandonado: Escape, ou o navegador cancelando o gesto.
   *
   * Sem isto, `activeId` ficava preso — o card seguia com aparência de
   * arrastado — e a pré-visualização do `dragOver` continuava aplicada **sem
   * nunca ser persistida**: o card ficava numa coluna que o banco não conhece
   * até a próxima revalidação da rota, que pode demorar a acontecer.
   */
  function handleDragCancel(event: DragCancelEvent) {
    setActiveId(null)
    const startStage = dragStartStage.current
    dragStartStage.current = null
    etapaPrevista.current = null

    if (startStage) moverPara(String(event.active.id), startStage)
  }

  /**
   * Grava a etapa, e garante que uma falha NÃO apague o Kanban.
   *
   * ## O defeito, relatado com vídeo em 11/09
   *
   * Mover um card mostrava o toast de sucesso e, logo depois, a tela virava
   * *"Não foi possível carregar esta tela"*. `error_logs` de produção confirma
   * React #185 em `/kanban` — inclusive hoje, 17:26.
   *
   * ## Por que `try/catch` e não só o `if (result?.error)`
   *
   * Erro DEVOLVIDO já era tratado. O LANÇADO não passa por nenhum `if`: rede
   * caindo, falha de transporte, qualquer `throw` na travessia da Server
   * Action. Sem captura, a rejeição sobe — e o card fica numa etapa que o banco
   * não conhece, com a UI mentindo sobre o que está gravado.
   *
   * **É a mesma classe que este projeto pagou hoje em seis lugares** (commit
   * `6074929`, o spinner que girava para sempre). Aqui o custo é maior porque o
   * dado visível fica errado.
   *
   * ## Desfazer é obrigatório, e o retry é oferecido
   *
   * Quem arrasta cinco cards não pode ser parado por um diálogo; quem perdeu um
   * movimento precisa de um caminho de volta que não seja arrastar de novo.
   * Toast com ação resolve os dois.
   */
  async function gravarEtapa(dealId: string, destino: DealStage, origem: DealStage | undefined) {
    const desfazer = () => {
      if (origem) moverPara(dealId, origem)
    }

    let result: Awaited<ReturnType<typeof updateDealStage>>
    try {
      result = await updateDealStage(dealId, destino)
    } catch (err) {
      console.error('updateDealStage rejeitou', err)
      desfazer()
      toast.error('Não foi possível mover o negócio. A alteração foi desfeita.', {
        action: { label: 'Tentar de novo', onClick: () => void gravarEtapa(dealId, destino, origem) },
      })
      return
    }

    if (result?.error) {
      desfazer()
      toast.error(result.error, {
        action: { label: 'Tentar de novo', onClick: () => void gravarEtapa(dealId, destino, origem) },
      })
      return
    }

    avisarMovido(dealId, destino)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    const dealId = String(active.id)
    const finalStage = over ? stageOf(String(over.id)) : undefined
    const startStage = dragStartStage.current
    dragStartStage.current = null
    etapaPrevista.current = null

    // Soltar fora de qualquer coluna, depois de a pré-visualização já ter
    // movido o card, deixaria ele numa etapa que ninguém vai gravar. É o mesmo
    // caso do cancelamento, e antes desta linha o `return` seco deixava passar.
    if (!finalStage) {
      if (startStage) moverPara(dealId, startStage)
      return
    }

    if (finalStage === startStage) return

    // A pré-visualização do `dragOver` já costuma ter aplicado isto; aqui é
    // idempotente e cobre o caso de o `over` só existir no `dragEnd`. Se a
    // Server Action falhar, desfaz para o estado anterior em vez de deixar a
    // UI mentir sobre o que está persistido no banco.
    moverPara(dealId, finalStage)

    await gravarEtapa(dealId, finalStage, startStage ?? undefined)
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

    await gravarEtapa(dealId, stage, previousStage)
  }

  async function handleCreateDeal(values: DealFormValues) {
    const result = await createDeal(values)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Negócio criado.')
  }

  /**
   * Traz para a tela a coluna pedida pela URL.
   *
   * O board rola na horizontal e, em tela estreita, a etapa em que a pessoa
   * clicou no funil pode estar inteiramente fora do campo de visão: sem isto,
   * o clique "funcionaria" e ainda assim pareceria não ter feito nada.
   *
   * `block: 'nearest'` de propósito — sem ele o navegador rola a PÁGINA para
   * centralizar a coluna, e o cabeçalho do funil sai de vista.
   */
  React.useEffect(() => {
    if (!etapaEmFoco) return
    const coluna = document.getElementById(`etapa-${etapaEmFoco}`)
    coluna?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [etapaEmFoco])

  const selectedDeal = deals.find((deal) => deal.id === selectedDealId)
  const activeDeal = deals.find((deal) => deal.id === activeId)

  const hasActiveFilters = search.trim() !== '' || ownerFilter !== 'todos' || soParados

  // Contado sobre `deals`, não sobre o filtrado: o botão precisa dizer quantos
  // existem, inclusive quando o próprio filtro está ligado.
  const quantosParados = React.useMemo(() => {
    if (!agora) return 0
    return deals.filter((d) => estadoDeMovimento(d, agora).parado).length
  }, [deals, agora])

  /**
   * Os nomes que a busca pode sugerir, tirados do que já está no board.
   *
   * Sem consulta ao banco de propósito: a lista sai de `deals` e `leadsById`,
   * que já estão em memória, então a sugestão responde na tecla e não custa
   * uma ida ao Supabase por caractere digitado. A limitação é honesta e vale
   * registrar: o board tem teto de carga por etapa (migration 0032), então
   * cliente que ficou de fora do que veio não aparece aqui. A busca por texto
   * continua funcionando igual, o que a sugestão faz é poupar digitar o nome
   * inteiro e acertar a grafia.
   *
   * Cada nome aparece UMA vez, com o que ele é (cliente, empresa ou negócio).
   * Cliente com três negócios sugeria o mesmo nome três vezes, e uma lista que
   * repete a mesma linha parece defeito.
   */
  const sugestoes = React.useMemo(() => {
    const vistos = new Map<string, { valor: string; tipo: string }>()

    const juntar = (valor: string | null | undefined, tipo: string) => {
      const limpo = valor?.trim()
      if (!limpo) return
      const chave = limpo.toLowerCase()
      if (vistos.has(chave)) return
      vistos.set(chave, { valor: limpo, tipo })
    }

    // Cliente primeiro: é por quem a pessoa procura, o negócio é o que ela
    // acha depois. Empresa no meio porque agrupa vários clientes.
    for (const deal of deals) {
      const lead = deal.lead_id ? leadsById.get(deal.lead_id) : undefined
      juntar(lead?.name, 'cliente')
    }
    for (const deal of deals) {
      const lead = deal.lead_id ? leadsById.get(deal.lead_id) : undefined
      juntar(lead?.company, 'empresa')
    }
    for (const deal of deals) juntar(deal.title, 'negócio')

    return Array.from(vistos.values())
  }, [deals, leadsById])

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
          {/* `value`/`onValueChange` controlam o TEXTO, não uma seleção: a
              busca continua sendo texto livre e filtrar por qualquer palavra
              segue funcionando. A sugestão só evita digitar o nome inteiro. */}
          <Autocomplete
            items={sugestoes}
            itemToStringValue={(item) => item.valor}
            value={search}
            onValueChange={setSearch}
          >
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <AutocompleteInput
                render={
                  <Input
                    placeholder="Buscar por negócio, contato ou empresa..."
                    aria-label="Buscar negócios"
                    className="pl-8"
                  />
                }
              />
            </div>
            <AutocompleteContent>
              <AutocompleteEmpty>Nenhum nome parecido.</AutocompleteEmpty>
              <AutocompleteList>
                {(item: { valor: string; tipo: string }) => (
                  <AutocompleteItem key={item.valor} value={item}>
                    <span className="flex-1 truncate">{item.valor}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {item.tipo}
                    </span>
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>

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
        collisionDetection={detectarColisao}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
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
              emFoco={stage === etapaEmFoco}
              onOpenDeal={setSelectedDealId}
              onAgendarDeal={abrirDealNoAgendamento}
              agora={agora}
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
              agora={agora}
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
        onAgendamentoAberto={marcarAgendamentoAberto}
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
