import { diaEmSaoPaulo } from '@/lib/tasks/buckets'
import type { TaskRow } from '@/lib/tasks/types'

/**
 * Agrupa tarefas por dia civil (`YYYY-MM-DD`, fuso São Paulo), para o modo
 * Mês/Semana do calendário desenhar os chips na célula certa.
 *
 * Diferente de `agruparPorPrazo` (`lib/tasks/buckets.ts`): aquela função
 * IGNORA tarefa concluída (`if (task.done_at) continue`) porque a tela /hoje
 * só quer mostrar o que falta fazer. O calendário quer o oposto — mostrar
 * também o que já aconteceu no mês —, então agrupa TODAS, concluídas e
 * pendentes, e quem lê o resultado decide como colorir cada uma.
 */
export function agruparTarefasPorDia(tasks: TaskRow[]): Map<string, TaskRow[]> {
  const porDia = new Map<string, TaskRow[]>()

  for (const task of tasks) {
    const dia = diaEmSaoPaulo(new Date(task.due_at))
    const lista = porDia.get(dia) ?? []
    lista.push(task)
    porDia.set(dia, lista)
  }

  for (const lista of Array.from(porDia.values())) {
    lista.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
  }

  return porDia
}
