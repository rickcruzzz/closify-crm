'use client'

import * as React from 'react'
import Link from 'next/link'
import { MoreHorizontal, Undo2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ConfirmarExclusao } from '@/components/comum/confirmar-exclusao'
import { rotuloDePrazo } from '@/lib/tasks/buckets'
import { iconePorTipo, taskTypeLabels, type TaskRow } from '@/lib/tasks/types'

const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})

export function TaskItem({
  task,
  agora,
  atrasada,
  pendente = false,
  onConcluir,
  onDesfazer,
  onEditar,
  onExcluir,
}: {
  task: TaskRow
  /** O instante vem de fora para que a lista inteira use o mesmo relógio. */
  agora: Date
  atrasada: boolean
  /** true enquanto concluir/excluir esta tarefa está em voo, trava a linha
   * para o clique duplo não disparar a Server Action duas vezes. */
  pendente?: boolean
  onConcluir: (taskId: string) => void
  /**
   * Só chega preenchido enquanto a tarefa está saindo da lista — os poucos
   * segundos em que ela aparece riscada. É o que põe o desfazer AO LADO da
   * tarefa, em vez de num aviso no canto oposto da tela que some sozinho.
   */
  onDesfazer?: (taskId: string) => void
  onEditar?: (task: TaskRow) => void
  onExcluir?: (taskId: string) => void
}) {
  const Icone = iconePorTipo[task.type]
  const concluida = Boolean(task.done_at)
  // O diálogo vive AQUI, e não em cada tela que lista tarefas, porque quem
  // pode apagar é este item. Nos dois consumidores atuais (`/hoje` e o painel
  // do lead) o pai só recebe a confirmação já dada, e qualquer tela nova que
  // renderize `TaskItem` nasce protegida sem precisar lembrar disso.
  const [confirmandoExclusao, setConfirmandoExclusao] = React.useState(false)

  return (
    <li className="hover:bg-accent/40 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors">
      <Checkbox
        checked={concluida}
        disabled={concluida || pendente}
        onCheckedChange={() => {
          if (!concluida && !pendente) onConcluir(task.id)
        }}
        aria-label={`Concluir: ${task.title}`}
      />

      <Icone
        aria-hidden
        className={cn(
          'size-4 shrink-0',
          atrasada ? 'text-destructive' : 'text-muted-foreground',
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate text-sm', concluida && 'text-muted-foreground line-through')}>
          {task.title}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {task.lead_id && task.lead_name ? (
            <Link href={`/leads/${task.lead_id}`} className="hover:underline">
              {task.lead_name}
            </Link>
          ) : (
            taskTypeLabels[task.type]
          )}
          {task.assignee_name && ` · ${task.assignee_name}`}
        </span>
      </div>

      {onDesfazer && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onDesfazer(task.id)}
        >
          <Undo2 className="size-4" />
          Desfazer
        </Button>
      )}

      <span
        className={cn(
          'shrink-0 text-right text-xs font-medium whitespace-nowrap',
          atrasada ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {/* Hora e rótulo relativo juntos: "hoje" sozinho não diz se é agora ou
            às 18h, e "14:30" sozinho não diz se é hoje ou semana que vem. */}
        {horaFormatada.format(new Date(task.due_at))}
        <span className="block font-normal">
          {rotuloDePrazo(task.due_at, agora, task.done_at)}
        </span>
      </span>

      {(onEditar || onExcluir) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Ações da tarefa">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {onEditar && (
              <DropdownMenuItem disabled={pendente} onClick={() => onEditar(task)}>
                Editar
              </DropdownMenuItem>
            )}
            {onExcluir && (
              <DropdownMenuItem
                variant="destructive"
                disabled={pendente}
                onClick={() => setConfirmandoExclusao(true)}
              >
                Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {onExcluir && (
        <ConfirmarExclusao
          open={confirmandoExclusao}
          onOpenChange={setConfirmandoExclusao}
          titulo="Excluir esta tarefa?"
          descricao={
            <>
              &quot;{task.title}&quot; sai da sua lista em definitivo. Se o objetivo é
              marcar como feita, use a caixa de seleção — assim ela fica no histórico.
            </>
          }
          pendente={pendente}
          onConfirmar={() => {
            setConfirmandoExclusao(false)
            onExcluir(task.id)
          }}
        />
      )}
    </li>
  )
}
