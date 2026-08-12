'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TaskItem } from '@/components/tasks/task-item'
import { TaskFormDialog, type TarefaEmEdicao } from '@/components/tasks/task-form-dialog'
import type { WorkspaceMember } from '@/lib/leads/queries'
import { agruparPorPrazo } from '@/lib/tasks/buckets'
import { taskBucketLabels, taskBuckets, type TaskRow } from '@/lib/tasks/types'
import { atualizarTarefa, concluirTarefa, excluirTarefa } from '@/lib/tasks/actions'
import type { TaskFormValues } from '@/lib/validations/task'

export function HojeClient({
  tasks: tasksIniciais,
  members,
  currentUserId,
  escopo,
}: {
  tasks: TaskRow[]
  members: WorkspaceMember[]
  currentUserId: string
  escopo: 'minhas' | 'equipe'
}) {
  const router = useRouter()
  const [tasks, setTasks] = React.useState(tasksIniciais)
  const [emEdicao, setEmEdicao] = React.useState<TarefaEmEdicao | null>(null)

  // O servidor manda a lista nova depois de cada revalidação; sem isto o
  // estado local ficaria preso na primeira renderização e a tarefa criada
  // noutra tela nunca apareceria aqui.
  React.useEffect(() => {
    setTasks(tasksIniciais)
  }, [tasksIniciais])

  /**
   * Um relógio só para a tela inteira.
   *
   * `new Date()` dentro de cada linha faria itens da MESMA lista discordarem
   * sobre o que é "atrasada" quando a renderização cruza o minuto. E ele nasce
   * no cliente, não no servidor: o servidor da Vercel está em UTC.
   */
  const [agora, setAgora] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setAgora(new Date())
    // Reavalia de minuto em minuto para que "hoje 15:00" vire "atrasada" sem
    // a pessoa precisar recarregar a página.
    const timer = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const grupos = React.useMemo(
    () => (agora ? agruparPorPrazo(tasks, agora) : null),
    [tasks, agora],
  )

  function trocarEscopo(valor: string | null) {
    router.push(valor === 'equipe' ? '/hoje?escopo=equipe' : '/hoje')
  }

  async function concluir(taskId: string) {
    // Some da lista antes da resposta: marcar tarefa é o gesto mais repetido
    // da tela, e esperar o servidor a cada clique tornaria a lista pesada.
    const anterior = tasks
    setTasks((atual) => atual.filter((t) => t.id !== taskId))

    const resultado = await concluirTarefa(taskId)

    if ('error' in resultado) {
      setTasks(anterior)
      toast.error(resultado.error)
      return
    }

    toast.success('Tarefa concluída.')
    router.refresh()
  }

  async function excluir(taskId: string) {
    const anterior = tasks
    setTasks((atual) => atual.filter((t) => t.id !== taskId))

    const resultado = await excluirTarefa(taskId)

    if ('error' in resultado) {
      setTasks(anterior)
      toast.error(resultado.error)
      return
    }

    toast.success('Tarefa excluída.')
    router.refresh()
  }

  async function salvarEdicao(values: TaskFormValues) {
    if (!emEdicao) return

    const resultado = await atualizarTarefa(emEdicao.id, values)

    if ('error' in resultado) {
      toast.error(resultado.error)
      return
    }

    toast.success('Tarefa atualizada.')
    setEmEdicao(null)
    router.refresh()
  }

  const total = tasks.length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hoje"
        description="O que precisa da sua atenção, por prazo."
        className="mb-0"
        actions={
          <Select value={escopo} onValueChange={trocarEscopo}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(v) => (v === 'equipe' ? 'Da equipe' : 'Minhas')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minhas">Minhas</SelectItem>
              <SelectItem value="equipe">Da equipe</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {total === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={CheckCircle2}
              title="Nada pendente"
              description={
                escopo === 'equipe'
                  ? 'Ninguém da equipe tem tarefa em aberto. Crie uma a partir de um lead ou de um negócio.'
                  : 'Você não tem tarefa em aberto. Abra um negócio no Pipeline e agende a próxima ação.'
              }
            >
              <Button
                variant="outline"
                onClick={() => router.push('/kanban')}
              >
                Ir para o Pipeline
              </Button>
            </EmptyState>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Enquanto `agora` não existe (primeira renderização, antes do
              efeito) não dá para agrupar sem arriscar usar o relógio do
              servidor, que está em UTC. */}
          {!agora || !grupos ? (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-center text-sm">
                Carregando suas tarefas…
              </CardContent>
            </Card>
          ) : (
            taskBuckets.map((bucket) => {
              const doGrupo = grupos[bucket]
              if (doGrupo.length === 0) return null

              const atrasado = bucket === 'atrasada'

              return (
                <Card key={bucket}>
                  <CardHeader>
                    <CardTitle
                      className={atrasado ? 'text-destructive text-base' : 'text-base'}
                    >
                      {taskBucketLabels[bucket]}
                      <span className="text-muted-foreground ml-2 text-sm font-normal">
                        {doGrupo.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col">
                      {doGrupo.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          agora={agora}
                          atrasada={atrasado}
                          onConcluir={concluir}
                          onEditar={(t) =>
                            setEmEdicao({
                              id: t.id,
                              title: t.title,
                              type: t.type,
                              due_at: t.due_at,
                              assignee_id: t.assignee_id,
                            })
                          }
                          onExcluir={excluir}
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      <TaskFormDialog
        open={emEdicao !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setEmEdicao(null)
        }}
        onSubmit={salvarEdicao}
        members={members}
        currentUserId={currentUserId}
        leadId={tasks.find((t) => t.id === emEdicao?.id)?.lead_id ?? null}
        dealId={tasks.find((t) => t.id === emEdicao?.id)?.deal_id ?? null}
        tarefa={emEdicao}
      />
    </div>
  )
}
