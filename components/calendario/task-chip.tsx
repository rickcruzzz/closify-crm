'use client'

import { cn } from '@/lib/utils'
import { iconePorTipo } from '@/lib/tasks/types'
import { corDaUrgencia, urgenciaDaProximaAcao } from '@/lib/kanban/urgencia'
import type { TaskRow } from '@/lib/tasks/types'

const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Uma tarefa como chip de linha, usado nas células do modo Mês e nas colunas
 * do modo Semana.
 *
 * A cor segue a MESMA regra de urgência que o Kanban e a tela /hoje já usam
 * (`lib/kanban/urgencia.ts`) — três lugares do produto não podem discordar
 * sobre o que é "atrasado" ou "hoje". Tarefa concluída nunca é `critico` nem
 * `atencao`: já aconteceu, cor neutra e texto riscado, não é mais uma
 * cobrança.
 */
export function TaskChip({
  task,
  agora,
  onClick,
}: {
  task: TaskRow
  agora: Date
  onClick: () => void
}) {
  const Icone = iconePorTipo[task.type]
  const concluida = Boolean(task.done_at)
  const urgencia = concluida ? 'neutro' : urgenciaDaProximaAcao(task.due_at, agora)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // `min-h-11` (44px) em mobile — mesmo piso de alvo de toque já
        // aplicado em select.tsx/combobox.tsx/month-grid.tsx — volta a
        // `min-h-6` (24px) a partir de `md:`, onde o toque é por mouse, para
        // não perder densidade na grade de mês em telas grandes.
        'hover:bg-accent flex min-h-11 w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors md:min-h-6',
        corDaUrgencia[urgencia],
      )}
      title={task.title}
    >
      <Icone aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{horaFormatada.format(new Date(task.due_at))}</span>
      <span className={cn('truncate', concluida && 'text-muted-foreground line-through')}>
        {task.title}
      </span>
    </button>
  )
}
