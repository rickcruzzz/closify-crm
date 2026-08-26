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
import { mesclarSaindo, type EmSaida } from '@/lib/tasks/mesclar-saindo'

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
  /**
   * Quem esta na janela de "riscada", com a posicao de onde saiu.
   *
   * NAO e so um Set de ids: o servidor ja removeu essas tarefas da lista dele,
   * entao guardar so o id nao bastaria para desenha-las. E a posicao evita que
   * a linha riscada pule para o fim, onde o olho a perde e o "Desfazer" fica
   * impossivel de acertar.
   */
  const [saindo, setSaindo] = React.useState<Map<string, EmSaida<TaskRow>>>(new Map())
  const [emEdicao, setEmEdicao] = React.useState<TarefaEmEdicao | null>(null)
  const [trocandoEscopo, startTransitionEscopo] = React.useTransition()

  // O servidor manda a lista nova depois de cada revalidação; sem isto o
  // estado local ficaria preso na primeira renderização e a tarefa criada
  // noutra tela nunca apareceria aqui.
  //
  // Sobrescrever aqui e SEGURO desde que `saindo` virou estado separado. Antes
  // nao era: esta linha apagava a tarefa que acabara de ser concluida, poucos
  // milissegundos depois do clique, porque `concluirTarefa` revalida `/hoje` e
  // a lista nova ja vem sem ela. A janela de desfazer nunca chegou a existir
  // para o usuario por causa deste efeito.
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

  /**
   * A lista que a tela mostra: o servidor mais quem ainda esta saindo.
   *
   * Derivada, nao estado. Enquanto ela era estado, a revalidacao que
   * `concluirTarefa` dispara substituia a lista inteira e a linha riscada
   * evaporava em milissegundos — o "Desfazer" nunca chegou a ser clicavel em
   * producao.
   */
  const lista = React.useMemo(() => mesclarSaindo(tasks, saindo), [tasks, saindo])

  const grupos = React.useMemo(
    // As chaves de `saindo` sao as que continuam agrupadas mesmo concluidas:
    // sem isso o agrupamento descarta a tarefa no instante em que ela ganha
    // `done_at`, e a janela de desfazer nao chega a aparecer.
    () => (agora ? agruparPorPrazo(lista, agora, new Set(saindo.keys())) : null),
    [lista, agora, saindo],
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
    // Ja esta na janela. Sem esta linha, um segundo clique montaria um timer
    // novo por cima do primeiro em `timers.current`, deixando o primeiro orfao
    // e vivo — ele dispararia sozinho e apagaria a linha antes da hora.
    if (saindo.has(taskId)) return

    const indice = lista.findIndex((t) => t.id === taskId)
    const alvo = indice >= 0 ? lista[indice] : undefined
    if (!alvo) return

    // A tarefa entra em `saindo` JA concluida, com a posicao de onde saiu.
    // `tasks` nao e tocado de proposito: ele e espelho do servidor, e a
    // revalidacao que vem daqui a pouco vai sobrescreve-lo de qualquer jeito.
    //
    // Era exatamente essa mistura que fazia a linha evaporar: o estado tentava
    // ser espelho e rascunho ao mesmo tempo, e a revalidacao ganhava sempre.
    setSaindo((atual) => {
      const novo = new Map(atual)
      novo.set(taskId, {
        task: { ...alvo, done_at: new Date().toISOString() },
        indice,
      })
      return novo
    })

    const resultado = await concluirTarefa(taskId)

    if ('error' in resultado) {
      setSaindo((atual) => {
        const novo = new Map(atual)
        novo.delete(taskId)
        return novo
      })
      toast.error(resultado.error)
      return
    }

    timers.current.set(
      taskId,
      setTimeout(() => {
        // So limpa `saindo`. A lista volta a ser o que o servidor ja mandou,
        // sem a tarefa — nao ha mais nada para filtrar nem corrida para perder.
        setSaindo((atual) => {
          const novo = new Map(atual)
          novo.delete(taskId)
          return novo
        })
        timers.current.delete(taskId)
        router.refresh()
      }, TEMPO_RISCADA_MS),
    )
  }

  /**
   * Troca o `done_at` de quem esta na janela, sem tirar da janela.
   *
   * E o que permite a linha desmarcar na hora do clique e continuar visivel no
   * lugar dela ate a lista do servidor alcancar.
   */
  function marcarNaJanela(taskId: string, doneAt: string | null) {
    setSaindo((atual) => {
      const anterior = atual.get(taskId)
      if (!anterior) return atual
      const novo = new Map(atual)
      novo.set(taskId, { ...anterior, task: { ...anterior.task, done_at: doneAt } })
      return novo
    })
  }

  /** Reabre a tarefa que ainda está na tela, antes de ela sair. */
  async function desfazerConclusao(taskId: string) {
    const timer = timers.current.get(taskId)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(taskId)
    }

    // Desmarca AGORA, antes de falar com o servidor.
    //
    // Medido em producao: `reabrirTarefa` leva ~3s. Enquanto ela corria, a
    // linha continuava riscada e o proprio botao "Desfazer" seguia na tela —
    // tres segundos em que o clique parecia nao ter funcionado. A tarefa
    // continua em `saindo` de proposito: tira-la aqui faria a linha sumir,
    // porque a lista do servidor ainda nao tem a tarefa reaberta.
    marcarNaJanela(taskId, null)

    const resultado = await reabrirTarefa(taskId)
    if ('error' in resultado) {
      // Volta a riscar: no banco ela continua concluida.
      marcarNaJanela(taskId, new Date().toISOString())
      toast.error(resultado.error)
      return
    }

    // Agora sim: `reabrirTarefa` revalidou, e a lista do servidor voltou a
    // trazer a tarefa aberta na posicao dela.
    setSaindo((atual) => {
      const novo = new Map(atual)
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

  const total = lista.length

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
        leadId={lista.find((t) => t.id === emEdicao?.id)?.lead_id ?? null}
        dealId={lista.find((t) => t.id === emEdicao?.id)?.deal_id ?? null}
        tarefa={emEdicao}
      />
    </div>
  )
}
