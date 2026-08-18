'use client'

import { cn } from '@/lib/utils'
import { TaskChip } from '@/components/calendario/task-chip'
import { diasDaSemana, rotuloCurtoDoDia } from '@/lib/calendario/semana'
import { diaEmSaoPaulo } from '@/lib/tasks/buckets'
import type { TaskRow } from '@/lib/tasks/types'

const NOMES_DOS_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/**
 * 7 colunas, mais espaço por dia que o modo Mês — pensado para ver conflito
 * de horário na semana, não só volume no mês.
 */
export function WeekView({
  diaAncora,
  tarefasPorDia,
  agora,
  onSelecionarTarefa,
}: {
  diaAncora: string
  tarefasPorDia: Map<string, TaskRow[]>
  agora: Date
  onSelecionarTarefa: (task: TaskRow) => void
}) {
  const dias = diasDaSemana(diaAncora)
  const hoje = diaEmSaoPaulo(agora)

  return (
    <div className="grid grid-cols-7 gap-2">
      {dias.map((dia, i) => (
        <div key={dia} className="flex flex-col gap-1">
          <div
            className={cn(
              'flex flex-col items-center rounded-md border p-1.5 text-center',
              dia === hoje ? 'border-primary' : 'border-transparent',
            )}
          >
            <span className="text-muted-foreground text-xs font-medium">
              {NOMES_DOS_DIAS[i]}
            </span>
            <span className={cn('text-sm font-medium', dia === hoje && 'text-primary')}>
              {rotuloCurtoDoDia(dia)}
            </span>
          </div>
          <div className="flex min-h-40 flex-col gap-1 rounded-md border p-1">
            {(tarefasPorDia.get(dia) ?? []).map((task) => (
              <TaskChip
                key={task.id}
                task={task}
                agora={agora}
                onClick={() => onSelecionarTarefa(task)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
