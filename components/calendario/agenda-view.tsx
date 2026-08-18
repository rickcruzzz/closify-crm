'use client'

import * as React from 'react'

import { EmptyState } from '@/components/ui/empty-state'
import { TaskItem } from '@/components/tasks/task-item'
import { rotuloDoDiaPorExtenso } from '@/lib/calendario/grade-do-mes'
import { agruparTarefasPorDia } from '@/lib/calendario/agrupar-por-dia'
import { classificar } from '@/lib/tasks/buckets'
import { CalendarX } from 'lucide-react'
import type { TaskRow } from '@/lib/tasks/types'

/**
 * Lista de tarefas agrupadas por dia, em ordem cronológica — leitura rápida,
 * padrão do mobile. Reusa `TaskItem`, o mesmo componente de linha da tela
 * /hoje, então uma tarefa parece igual nos dois lugares do produto.
 *
 * Diferente de `agruparPorPrazo` (usado em /hoje, que ignora concluída): aqui
 * TODAS aparecem, porque a Agenda do calendário é "o que aconteceu e vai
 * acontecer neste período", não "o que falta fazer".
 */
export function AgendaView({
  tasks,
  agora,
  onConcluir,
  onSelecionarTarefa,
}: {
  tasks: TaskRow[]
  agora: Date
  onConcluir: (taskId: string) => void
  onSelecionarTarefa: (task: TaskRow) => void
}) {
  const porDia = React.useMemo(() => agruparTarefasPorDia(tasks), [tasks])
  const dias = React.useMemo(() => Array.from(porDia.keys()).sort(), [porDia])

  if (dias.length === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title="Nada neste período"
        description="Não há tarefa com prazo dentro do intervalo selecionado."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {dias.map((dia) => (
        <div key={dia} className="flex flex-col gap-1">
          <h3 className="text-muted-foreground px-2 text-sm font-medium">
            {rotuloDoDiaPorExtenso(dia)}
          </h3>
          <ul className="flex flex-col">
            {(porDia.get(dia) ?? []).map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                agora={agora}
                atrasada={!task.done_at && classificar(task, agora) === 'atrasada'}
                onConcluir={onConcluir}
                // Reusa a ação "Editar" do menu "..." que `TaskItem` já tem,
                // para abrir o drawer de detalhe — sem envolver o item numa
                // `<div onClick>` própria, que brigaria com o clique do
                // checkbox de concluir e com o menu de ações.
                onEditar={onSelecionarTarefa}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
