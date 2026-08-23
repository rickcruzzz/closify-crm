'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, KanbanSquare, Loader2, Users } from 'lucide-react'

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
import {
  atualizarTarefa,
  concluirTarefa,
  excluirTarefa,
  reabrirTarefa,
} from '@/lib/tasks/actions'
import type { TaskFormValues } from '@/lib/validations/task'

/**
 * Quanto tempo a tarefa concluída fica visível, riscada, antes de sair.
 *
 * Longo o bastante para o olho registrar o que aconteceu e a mão alcançar o
 * "Desfazer"; curto o bastante para a lista não virar um cemitério de itens
 * já feitos enquanto a pessoa trabalha.
 */
const TEMPO_RISCADA_MS = 4_000

export function HojeClient({
  tasks: tasksIniciais,
  members,
  currentUserId,
  escopo,
  temNegocio,
  temLead,
}: {
  tasks: TaskRow[]
  members: WorkspaceMember[]
  currentUserId: string
  escopo: 'minhas' | 'equipe'
  /** A empresa já tem negócio no funil? Decide o que a tela vazia diz. */
  temNegocio: boolean
  /** E já tem ao menos um contato? */
  temLead: boolean
}) {
  const router = useRouter()
  const [tasks, setTasks] = React.useState(tasksIniciais)
  const [emEdicao, setEmEdicao] = React.useState<TarefaEmEdicao | null>(null)
  const [trocandoEscopo, startTransitionEscopo] = React.useTransition()

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
    startTransitionEscopo(() => {
      router.push(valor === 'equipe' ? '/hoje?escopo=equipe' : '/hoje')
    })
  }

  /**
   * Quem acabou de ser concluída e ainda está na tela, riscada.
   *
   * A tarefa sumia no mesmo instante do clique. Funcionava, mas não dava tempo
   * de registrar o que tinha acontecido — e o "Desfazer" ficava num aviso no
   * canto oposto da tela, longe do lugar onde a pessoa estava olhando.
   *
   * Agora ela fica alguns segundos riscada, no próprio lugar, com o desfazer
   * ao lado. Some depois. Continua sem pedir confirmação: concluir tarefa é o
   * gesto mais repetido do produto, e um "tem certeza?" a cada clique viraria
   * imposto diário — o que se ganha aqui é ver o erro, não evitá-lo com atrito.
   */
  const [saindo, setSaindo] = React.useState<Set<string>>(new Set())
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Um timer que dispara depois de a tela trocar tentaria atualizar estado de
  // um componente que já não existe.
  React.useEffect(() => {
    const mapa = timers.current
    return () => {
      mapa.forEach((t) => clearTimeout(t))
      mapa.clear()
    }
  }, [])

  async function concluir(taskId: string) {
    const anterior = tasks
    // Marca como concluída SEM tirar da lista: é isso que deixa a linha
    // riscada no lugar em vez de evaporar.
    setTasks((atual) =>
      atual.map((t) => (t.id === taskId ? { ...t, done_at: new Date().toISOString() } : t)),
    )
    setSaindo((atual) => new Set(atual).add(taskId))

    const resultado = await concluirTarefa(taskId)

    if ('error' in resultado) {
      setTasks(anterior)
      setSaindo((atual) => {
        const novo = new Set(atual)
        novo.delete(taskId)
        return novo
      })
      toast.error(resultado.error)
      return
    }

    timers.current.set(
      taskId,
      setTimeout(() => {
        setTasks((atual) => atual.filter((t) => t.id !== taskId))
        setSaindo((atual) => {
          const novo = new Set(atual)
          novo.delete(taskId)
          return novo
        })
        timers.current.delete(taskId)
        router.refresh()
      }, TEMPO_RISCADA_MS),
    )
  }

  /** Reabre a tarefa que ainda está na tela, antes de ela sair. */
  async function desfazerConclusao(taskId: string) {
    const timer = timers.current.get(taskId)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(taskId)
    }

    const resultado = await reabrirTarefa(taskId)
    if ('error' in resultado) {
      toast.error(resultado.error)
      return
    }

    setTasks((atual) =>
      atual.map((t) => (t.id === taskId ? { ...t, done_at: null } : t)),
    )
    setSaindo((atual) => {
      const novo = new Set(atual)
      novo.delete(taskId)
      return novo
    })
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
          <div className="flex items-center gap-2">
            <Select value={escopo} onValueChange={trocarEscopo} disabled={trocandoEscopo}>
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
            {trocandoEscopo && (
              <Loader2 aria-hidden className="text-muted-foreground size-4 animate-spin" />
            )}
          </div>
        }
      />

      {total === 0 ? (
        <Card>
          <CardContent>
            {/* Três situações diferentes mostravam a MESMA tela de parabéns.
                `/hoje` é a primeira tela depois do login, e um check verde
                escrito "Nada pendente" para quem acabou de criar a conta lê
                como "está tudo em dia": é a mensagem de quem terminou o
                trabalho, dada a quem ainda não começou.

                Medido no banco: 11 das 21 empresas nunca criaram um lead, e
                96% dos negócios abertos não têm próxima ação. Quem chega aqui
                precisa saber qual é o próximo passo, não ser parabenizado. */}
            {!temLead ? (
              <EmptyState
                icon={Users}
                title="Comece cadastrando um cliente"
                description="Assim que você tiver um contato aqui, o Velo Funil passa a avisar com quem falar cada dia."
              >
                <Button onClick={() => router.push('/leads')}>Cadastrar cliente</Button>
              </EmptyState>
            ) : !temNegocio ? (
              <EmptyState
                icon={KanbanSquare}
                title="Coloque um cliente no funil"
                description="Um negócio no funil é o que dá o que fazer: dele sai a próxima ação que aparece nesta tela."
              >
                <Button onClick={() => router.push('/kanban')}>Abrir o funil</Button>
              </EmptyState>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title={escopo === 'equipe' ? 'Ninguém tem tarefa em aberto' : 'Nada pendente'}
                description={
                  escopo === 'equipe'
                    ? 'Nenhum negócio da equipe tem próxima ação marcada. Sem isso, é fácil um cliente ficar sem resposta.'
                    : 'Nenhum negócio seu tem próxima ação marcada. Abra o funil e agende o próximo passo de quem está parado.'
                }
              >
                <Button variant="outline" onClick={() => router.push('/kanban')}>
                  Ir para o funil
                </Button>
              </EmptyState>
            )}
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
                          onDesfazer={saindo.has(task.id) ? desfazerConclusao : undefined}
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
