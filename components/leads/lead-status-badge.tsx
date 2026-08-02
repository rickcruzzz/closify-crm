import { cn } from '@/lib/utils'
import { leadStatusLabels, type LeadStatus } from '@/lib/leads/types'

const statusStyles: Record<LeadStatus, string> = {
  novo: 'bg-blue-500/10 text-blue-500 dark:bg-blue-400/10 dark:text-blue-400',
  contato_realizado: 'bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400',
  proposta_enviada:
    'bg-violet-500/10 text-violet-500 dark:bg-violet-400/10 dark:text-violet-400',
  negociacao: 'bg-orange-500/10 text-orange-500 dark:bg-orange-400/10 dark:text-orange-400',
  fechado_ganho:
    'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-400/10 dark:text-emerald-400',
  fechado_perdido: 'bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-400',
}

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        statusStyles[status],
        className,
      )}
    >
      {leadStatusLabels[status]}
    </span>
  )
}
