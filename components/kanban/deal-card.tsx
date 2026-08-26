import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DealStage } from '@/lib/deals/types'
import type { DealRow, DealLeadRow } from '@/lib/deals/queries'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ProximaAcao } from '@/components/kanban/proxima-acao'
import type { ProximaAcaoRow } from '@/lib/tasks/types'
import { formatarValorDeNegocio } from '@/lib/deals/metrics'
import { estadoDeMovimento, rotuloDeParado } from '@/lib/deals/parado'
import { corDaUrgencia, urgenciaSemProximaAcao } from '@/lib/kanban/urgencia'
import { iniciais } from '@/lib/leads/iniciais'

const stageAccent: Record<DealStage, string> = {
  novo: 'border-l-blue-500 dark:border-l-blue-400',
  contato_realizado: 'border-l-amber-500 dark:border-l-amber-400',
  proposta_enviada: 'border-l-violet-500 dark:border-l-violet-400',
  negociacao: 'border-l-orange-500 dark:border-l-orange-400',
  fechado_ganho: 'border-l-emerald-500 dark:border-l-emerald-400',
  fechado_perdido: 'border-l-red-500 dark:border-l-red-400',
}

// `React.memo`: `handleDragOver` (kanban-board.tsx) só troca o objeto do
// card ATIVO a cada tick de arrasto, `prev.map` mantém a mesma referência
// pros demais. Sem memo, mover um card re-renderizava todo o board inteiro
// (todas as colunas, todos os cards) a cada cruzamento de coluna; boards
// com dezenas/centenas de negócios sentiam isso como travamento.
export const DealCard = React.memo(function DealCard({
  deal,
  lead,
  proximaAcao,
  onOpen,
  onAgendar,
  agora,
}: {
  deal: DealRow
  lead: DealLeadRow | undefined
  /** A tarefa aberta mais próxima deste negócio. Ausente: não há nenhuma. */
  proximaAcao: ProximaAcaoRow | undefined
  onOpen: (dealId: string) => void
  /** Abre o negócio já com o agendamento aberto, a partir do aviso do card. */
  onAgendar: (dealId: string) => void
  /**
   * O relógio do board, criado no CLIENTE.
   *
   * `null` antes do primeiro efeito: o servidor da Vercel roda em UTC e
   * calcular "parado há N dias" lá erraria a virada do dia. Sem ele, o card
   * simplesmente não fala de tempo, em vez de arriscar um número errado.
   */
  agora: Date | null
}) {
  // A informação já existia e não aparecia: `estadoDeMovimento` alimentava só
  // o botão de filtro "Parados", então um negócio movido ontem e outro
  // congelado há dois meses tinham cards idênticos.
  const movimento = agora ? estadoDeMovimento(deal, agora) : null

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: deal.id,
      data: { stage: deal.stage },
    })

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
          'hover:bg-accent/40 cursor-grab border-l-2 transition-colors hover:shadow-sm active:cursor-grabbing',
          stageAccent[deal.stage],
          isDragging && 'opacity-40',
        )}
      >
        <CardContent className="flex flex-col gap-1.5">
          {/* `title` com o valor cheio: o card abrevia acima de um milhão
              para o número não virar a coisa mais pesada do card, mas quem
              precisa do centavo consegue ver passando o mouse. */}
          <span
            className="text-base font-semibold"
            title={deal.value.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          >
            {formatarValorDeNegocio(deal.value)}
          </span>
          <div className="flex flex-col items-start">
            {/* O card inteiro é o alvo de drag (dnd-kit ocupa Enter/Espaço
                para pegar e soltar), então abrir o detalhe precisa do próprio
                alvo focável, senão a ação fica inacessível por teclado. */}
            <button
              type="button"
              className="focus-visible:ring-ring/50 -my-1 flex min-h-6 max-w-full items-center rounded-sm py-1 text-left text-sm outline-none hover:underline focus-visible:ring-3"
              onClick={(event) => {
                event.stopPropagation()
                onOpen(deal.id)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.stopPropagation()
                onOpen(deal.id)
              }}
            >
              {deal.title}
            </button>
            {lead && (
              <span className="text-muted-foreground truncate text-xs">
                {lead.company}
              </span>
            )}
          </div>
          {/* Só aparece quando já preocupa. Negócio que anda normal não ganha
              texto nenhum: o card fala quando tem o que dizer. */}
          {movimento?.parado && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                corDaUrgencia[urgenciaSemProximaAcao(movimento.dias)],
              )}
            >
              <Clock aria-hidden className="size-3 shrink-0" />
              {rotuloDeParado(movimento.dias)}
            </span>
          )}
          <div className="mt-1 flex items-center justify-between gap-2">
            <Avatar size="sm">
              <AvatarFallback>{iniciais(deal.owner_name ?? '?')}</AvatarFallback>
            </Avatar>
            <ProximaAcao
              task={proximaAcao}
              onAgendar={() => onAgendar(deal.id)}
              diasParado={movimento?.dias ?? 0}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
