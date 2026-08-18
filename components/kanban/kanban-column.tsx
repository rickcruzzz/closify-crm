import * as React from 'react'
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
import { formatarValorDeNegocio } from '@/lib/deals/metrics'

// `React.memo`: mesma razão de `DealCard`, sem isso, o board inteiro
// (6 colunas) refazia o trabalho de renderizar toda coluna a cada tick de
// arrasto, mesmo colunas sem nenhum negócio envolvido no drag.
export const KanbanColumn = React.memo(function KanbanColumn({
  stage,
  deals,
  leadsById,
  proximaAcaoPorNegocio,
  totalNaEtapa,
  onOpenDeal,
  onAgendarDeal,
  filtered = false,
  compact = false,
  agora,
}: {
  stage: DealStage
  deals: DealRow[]
  leadsById: Map<string, DealLeadRow>
  /** Tarefa aberta mais próxima de cada negócio, resolvida uma vez no servidor. */
  proximaAcaoPorNegocio: Map<string, ProximaAcaoRow>
  /** Quantos negócios esta etapa tem no banco, além dos que vieram. */
  totalNaEtapa: number
  onOpenDeal: (dealId: string) => void
  /** Abre o negócio já no agendamento, vindo do aviso do card. */
  onAgendarDeal: (dealId: string) => void
  filtered?: boolean
  /** Board inteiro sem nenhum negócio: encolhe a coluna. */
  compact?: boolean
  /** Relógio do cliente, repassado ao card para o cálculo de "parado há N". */
  agora: Date | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } })
  const total = deals.reduce((sum, deal) => sum + deal.value, 0)

  // Compara com o total do BANCO, não com o board filtrado: quem digitou na
  // busca reduziu a lista de propósito e não precisa ser avisado disso.
  const cortou = !filtered && totalNaEtapa > deals.length

  return (
    <div className="w-72 shrink-0 snap-start">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{dealStageLabels[stage]}</span>
          {/* Quando a etapa tem mais do que o board carrega, o número mostra os
              dois. Cortar em silêncio é o defeito que a 0032 veio consertar,
              repeti-lo aqui, com um número nosso em vez do teto do PostgREST,
              não seria melhor. */}
          <Badge variant="secondary" title={cortou ? `${totalNaEtapa} no total` : undefined}>
            {cortou ? `${deals.length} de ${totalNaEtapa}` : deals.length}
          </Badge>
        </div>
        {/* Abreviado acima de um milhão, valor cheio no `title`: com um
            negócio de dez dígitos na etapa, o total virava a coisa mais larga
            do cabeçalho e empurrava o nome da etapa. */}
        <span
          className="text-muted-foreground text-xs font-medium"
          title={total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        >
          {formatarValorDeNegocio(total)}
        </span>
      </div>

      {/* `dvh` em vez de `vh`: no iOS/Android a barra de URL entra e sai do
          viewport e `100vh` deixa o fim da coluna abaixo da dobra. O desconto
          é maior abaixo de `lg` porque a barra de filtros empilha em três
          linhas, o mesmo breakpoint usado em `kanban-board`.

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
                  onAgendar={onAgendarDeal}
                  agora={agora}
                />
              ))
            )}
          </SortableContext>
        </div>
      </ScrollArea>
    </div>
  )
})
