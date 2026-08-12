import { cn } from '@/lib/utils'
import type { DealStage } from '@/lib/deals/types'
import type { DealRow, DealLeadRow } from '@/lib/deals/queries'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ProximaAcao } from '@/components/kanban/proxima-acao'
import type { ProximaAcaoRow } from '@/lib/tasks/types'

const stageAccent: Record<DealStage, string> = {
  novo: 'border-l-blue-500 dark:border-l-blue-400',
  contato_realizado: 'border-l-amber-500 dark:border-l-amber-400',
  proposta_enviada: 'border-l-violet-500 dark:border-l-violet-400',
  negociacao: 'border-l-orange-500 dark:border-l-orange-400',
  fechado_ganho: 'border-l-emerald-500 dark:border-l-emerald-400',
  fechado_perdido: 'border-l-red-500 dark:border-l-red-400',
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

// Espelha `DealCard` de propósito, campo a campo. O overlay é o que a pessoa
// vê enquanto arrasta: se ele omitir a linha da próxima ação, o card muda de
// altura no instante em que é pego e o movimento parece um defeito.
export function DealCardOverlay({
  deal,
  lead,
  proximaAcao,
}: {
  deal: DealRow
  lead: DealLeadRow | undefined
  proximaAcao: ProximaAcaoRow | undefined
}) {
  return (
    <Card
      size="sm"
      className={cn(
        'w-72 rotate-1 cursor-grabbing border-l-2 shadow-lg',
        stageAccent[deal.stage],
      )}
    >
      <CardContent className="flex flex-col gap-1.5">
        <span className="text-base font-semibold">{formatBRL(deal.value)}</span>
        <div className="flex flex-col">
          <span className="truncate text-sm">{deal.title}</span>
          {lead && (
            <span className="text-muted-foreground truncate text-xs">{lead.company}</span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <Avatar size="sm">
            <AvatarFallback>{initials(deal.owner_name ?? '?')}</AvatarFallback>
          </Avatar>
          <ProximaAcao task={proximaAcao} />
        </div>
      </CardContent>
    </Card>
  )
}
