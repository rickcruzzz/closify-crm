import { cn } from '@/lib/utils'
import { leadStatusLabels, type LeadStatus } from '@/lib/leads/types'

/**
 * O tom do TEXTO muda entre os temas; o do fundo, não.
 *
 * O fundo é a própria cor a 10%, o que sobre o card branco resulta em algo
 * quase branco — então o texto precisa carregar todo o contraste sozinho. Em
 * `-500` isso não acontecia: amber dava ~2.2:1 e emerald ~2.6:1 sobre esse
 * fundo, contra os 4.5:1 que AA exige de texto pequeno (o badge é `text-xs`).
 * No escuro o mesmo `-400` sempre funcionou, e é por isso que o defeito só
 * aparecia para quem usa o tema claro.
 *
 * Os tons escolhidos não são uniformes de propósito: amber e emerald são
 * intrinsecamente claros e precisam de `-700` para passar, enquanto blue,
 * violet e red já passam em `-600`. Igualar tudo em nome da simetria
 * escureceria três cores sem necessidade.
 */
const statusStyles: Record<LeadStatus, string> = {
  novo: 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400',
  contato_realizado: 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400',
  proposta_enviada:
    'bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400',
  negociacao: 'bg-orange-500/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400',
  fechado_ganho:
    'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400',
  fechado_perdido: 'bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-400',
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
