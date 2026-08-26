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
import { Clock } from 'lucide-react'
import { iniciais } from '@/lib/leads/iniciais'

const stageAccent: Record<DealStage, string> = {
  novo: 'border-l-blue-500 dark:border-l-blue-400',
  contato_realizado: 'border-l-amber-500 dark:border-l-amber-400',
  proposta_enviada: 'border-l-violet-500 dark:border-l-violet-400',
  negociacao: 'border-l-orange-500 dark:border-l-orange-400',
  fechado_ganho: 'border-l-emerald-500 dark:border-l-emerald-400',
  fechado_perdido: 'border-l-red-500 dark:border-l-red-400',
}

// Espelha `DealCard` de propósito, campo a campo. O overlay é o que a pessoa
// vê enquanto arrasta: se ele omitir a linha da próxima ação, o card muda de
// altura no instante em que é pego e o movimento parece um defeito.
export function DealCardOverlay({
  deal,
  lead,
  proximaAcao,
  agora,
}: {
  deal: DealRow
  lead: DealLeadRow | undefined
  proximaAcao: ProximaAcaoRow | undefined
  /**
   * O mesmo relógio que o card usa.
   *
   * Sem ele o overlay não renderizaria a linha de "parado há N dias" e o card
   * ENCOLHERIA no instante em que fosse pego — a armadilha que
   * `docs/estado-atual.md` já registra: este arquivo duplica a marcação de
   * `deal-card.tsx` à mão, e mudar um sem o outro faz o card trocar de altura
   * durante o arrasto, o que parece defeito.
   */
  agora: Date | null
}) {
  const movimento = agora ? estadoDeMovimento(deal, agora) : null

  return (
    <Card
      size="sm"
      className={cn(
        'w-72 rotate-1 cursor-grabbing border-l-2 shadow-lg',
        stageAccent[deal.stage],
      )}
    >
      <CardContent className="flex flex-col gap-1.5">
        <span className="text-base font-semibold">
          {formatarValorDeNegocio(deal.value)}
        </span>
        <div className="flex flex-col items-start">
          {/* As classes de espaçamento copiam as do `<button>` do título em
              `deal-card.tsx` — `-my-1`, `min-h-6`, `py-1` — apesar de aqui ser
              um `<span>` (o overlay não é clicável). Sem elas o card mudava de
              altura ao ser pego: medido, 146px parado contra 151px no
              overlay, e um card que cresce no instante do arrasto parece
              defeito. */}
          <span className="-my-1 flex min-h-6 max-w-full items-center truncate py-1 text-sm">
            {deal.title}
          </span>
          {lead && (
            <span className="text-muted-foreground truncate text-xs">{lead.company}</span>
          )}
        </div>
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
          <ProximaAcao task={proximaAcao} diasParado={movimento?.dias ?? 0} />
        </div>
      </CardContent>
    </Card>
  )
}
