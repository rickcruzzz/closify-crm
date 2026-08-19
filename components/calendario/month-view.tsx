'use client'

import { cn } from '@/lib/utils'
import { MonthGrid } from '@/components/ui/month-grid'
import { TaskChip } from '@/components/calendario/task-chip'
import { diaEmSaoPaulo } from '@/lib/tasks/buckets'
import type { TaskRow } from '@/lib/tasks/types'

/** Até quantos chips uma célula mostra antes de resumir em "+N". */
const MAX_CHIPS_POR_DIA = 3

export function MonthView({
  ano,
  mes,
  onNavegarMes,
  tarefasPorDia,
  agora,
  onSelecionarTarefa,
  onVerMais,
}: {
  ano: number
  mes: number
  onNavegarMes: (direcao: -1 | 1) => void
  tarefasPorDia: Map<string, TaskRow[]>
  agora: Date
  onSelecionarTarefa: (task: TaskRow) => void
  /** Clicar num dia com mais itens do que cabe muda pro modo Agenda naquele dia. */
  onVerMais: (dia: string) => void
}) {
  const hoje = diaEmSaoPaulo(agora)

  return (
    <MonthGrid
      ano={ano}
      mes={mes}
      onNavegarMes={onNavegarMes}
      // O cabeçalho de navegação (mês + setas) já é desenhado por
      // `calendario-client.tsx`, mesmo elemento reusado pelo modo Semana —
      // dois cabeçalhos duplicados aqui, achado testando visualmente.
      mostrarNavegacao={false}
      renderizarDia={(dia, numeroDoDia, ehDoMesCorrente) => {
        const tarefas = tarefasPorDia.get(dia) ?? []
        const visiveis = tarefas.slice(0, MAX_CHIPS_POR_DIA)
        const resto = tarefas.length - visiveis.length

        return (
          <div
            className={cn(
              'flex min-h-24 flex-col gap-0.5 rounded-md border p-1',
              dia === hoje ? 'border-primary' : 'border-transparent',
              !ehDoMesCorrente && 'opacity-40',
            )}
          >
            <span
              className={cn(
                'px-1 text-xs font-medium',
                dia === hoje ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {numeroDoDia}
            </span>
            {visiveis.map((task) => (
              <TaskChip
                key={task.id}
                task={task}
                agora={agora}
                onClick={() => onSelecionarTarefa(task)}
              />
            ))}
            {resto > 0 && (
              <button
                type="button"
                onClick={() => onVerMais(dia)}
                className="text-muted-foreground hover:text-foreground flex min-h-11 items-center px-1 text-left text-xs transition-colors md:min-h-0"
              >
                +{resto}
              </button>
            )}
          </div>
        )
      }}
    />
  )
}
