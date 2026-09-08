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
} from '@/lib/tasks/actions'
import type { TaskFormValues } from '@/lib/validations/task'
import { COOKIE_ESCOPO, MAX_AGE_ESCOPO, type EscopoDeTarefas } from '@/lib/tasks/escopo'
import { CABECALHOS } from '@/lib/telas/cabecalhos'


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
  escopo: EscopoDeTarefas
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
  //
  // Sobrescrever aqui e seguro agora que concluir remove a linha localmente e
  // NAO pede refresh: quando esta lista chega, ela ja vem do servidor sem a
  // tarefa concluida. Antes nao era — este efeito apagava a linha recem
  // concluida poucos milissegundos depois do clique, e era por isso que a
  // janela de desfazer precisava de um estado separado para sobreviver.
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
    // Sem o terceiro argumento: nao ha mais tarefa concluida na tela que
    // precise continuar no grupo de origem. Quem conclui, sai.
    () => (agora ? agruparPorPrazo(tasks, agora) : null),
    [tasks, agora],
  )

  function trocarEscopo(valor: string | null) {
    const novo: EscopoDeTarefas = valor === 'equipe' ? 'equipe' : 'minhas'

    // Guarda a escolha ANTES de recarregar: quem le este cookie e o servidor,
    // em `app/(dashboard)/hoje/page.tsx`.
    document.cookie = `${COOKIE_ESCOPO}=${novo}; path=/; max-age=${MAX_AGE_ESCOPO}; samesite=lax`

    startTransitionEscopo(() => {
      // `refresh`, e nao `push('?escopo=...')`. Duas razoes, as duas medidas.
      //
      // 1. O App Router guarda o RSC de cada URL e o REPLICA quando se volta
      //    por `<Link>`, sem perguntar ao servidor. Com o escopo na URL
      //    existiam duas chaves de cache — `/hoje` e `/hoje?escopo=equipe` —
      //    e o item "Hoje" da barra lateral aponta para a primeira: voltar
      //    pelo menu servia o payload antigo, gravado antes de a escolha
      //    existir. Medido: cookie certo no navegador, tela em "Minhas".
      //    Com uma chave so, o `refresh` invalida ELA, e o payload guardado
      //    ja passa a ser o da escolha nova.
      //
      // 2. Sem `push`, nao ha entrada nova no historico: o botao "voltar"
      //    do navegador sai de /hoje, em vez de desfazer a troca de filtro.
      router.replace('/hoje')
      router.refresh()
    })
  }

  /**
   * ## Por que não há mais janela de "riscada + Desfazer"
   *
   * Ela existia porque a conclusão era imediata e sem pergunta: o comentário
   * antigo registrava que *"um 'tem certeza?' a cada clique viraria imposto
   * diário — o que se ganha aqui é ver o erro, não evitá-lo com atrito"*.
   *
   * O pedido de 07/09 inverteu a escolha: perguntar ANTES. As duas coisas
   * juntas seriam atrito dobrado — confirmar e ainda esperar uma janela para se
   * arrepender —, então a confirmação substitui a janela.
   *
   * O que morreu junto, e é o que torna esta troca barata: o estado `saindo`,
   * o `mesclarSaindo`, os temporizadores e o `router.refresh()` que sincronizava
   * tudo isso. Esse refresh era a causa do "a página recarrega" relatado.
   *
   * `reabrirTarefa` continua existindo e usada — `lib/tasks/avisar-concluida.ts`
   * a chama a partir das outras telas.
   */

  /**
   * Conclui, sem recarregar a pagina.
   *
   * ## O que mudou, e por que
   *
   * A versao anterior punha a tarefa numa janela de "riscada + Desfazer" e,
   * 600ms depois, chamava `router.refresh()` para o contador da barra lateral
   * acompanhar. Esse refresh era o "recarregamento" que aparecia na tela: ele
   * repinta a arvore inteira do servidor, e num clique que a pessoa acabou de
   * dar isso se le como a pagina piscando.
   *
   * Agora a confirmacao vem ANTES (`confirmarConclusao` em `TaskItem`), e o
   * desfazer-depois deixa de ser necessario: quem confirmou nao precisa de uma
   * janela para se arrepender. Sem a janela, nao ha o que sincronizar com o
   * servidor, e sem sincronizar nao ha refresh.
   *
   * ## O padrao e o mesmo de `excluir`, logo abaixo
   *
   * Guarda a lista anterior, tira a linha na hora, e devolve tudo se o servidor
   * recusar. Nao e implementacao nova: e o caminho que esta tela ja usa para a
   * outra acao que remove uma linha.
   *
   * ## O contador da barra lateral
   *
   * Ele passa a ficar desatualizado ate a proxima navegacao. E a troca que o
   * pedido implica: o refresh existia so para ele, e custava repintar a tela
   * inteira a cada tarefa concluida. Numero de contador errado por alguns
   * segundos incomoda menos que a tela piscando a cada clique.
   */
  async function concluir(taskId: string) {
    const anterior = tasks
    setTasks((atual) => atual.filter((t) => t.id !== taskId))

    const resultado = await concluirTarefa(taskId)

    if ('error' in resultado) {
      // A linha VOLTA para onde estava: `anterior` e a lista inteira, entao a
      // posicao dela dentro do grupo se preserva sozinha.
      setTasks(anterior)
      toast.error(resultado.error)
    }
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
        {...CABECALHOS.hoje}
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
              <Loader2
                aria-hidden
                className="text-muted-foreground size-4 animate-spin"
              />
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
                // "Cliente" era a única tela do produto que chamava assim.
                // Contatos, Funil e Resultados dizem "contato", e a renomeação
                // de 19/08 padronizou o vocabulário justamente para a mesma
                // coisa não ter dois nomes. Esta tela escapou dela, e é a
                // primeira que a pessoa abre pelo menu.
                title="Comece cadastrando um contato"
                description="Assim que você tiver um contato aqui, o Velo Funil passa a avisar com quem falar cada dia."
              >
                <Button onClick={() => router.push('/leads')}>Cadastrar contato</Button>
              </EmptyState>
            ) : !temNegocio ? (
              <EmptyState
                icon={KanbanSquare}
                // "Cliente" aqui pelo mesmo motivo do estado acima: a tela
                // dizia cliente onde o resto do produto diz contato.
                title="Coloque um contato no funil"
                description="Um negócio no funil é o que dá o que fazer: dele sai a próxima ação que aparece nesta tela."
              >
                <Button onClick={() => router.push('/kanban')}>Abrir o funil</Button>
              </EmptyState>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title={
                  escopo === 'equipe' ? 'Ninguém tem tarefa em aberto' : 'Nada pendente'
                }
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
                          // Pergunta antes de concluir, so aqui. Ver o prop em
                          // `TaskItem`: no painel do lead e na agenda o clique
                          // continua concluindo direto.
                          confirmarConclusao
                          onEditar={(t) =>
                            setEmEdicao({
                              id: t.id,
                              title: t.title,
                              type: t.type,
                              due_at: t.due_at,
                              assignee_id: t.assignee_id,
                              lead_id: t.lead_id,
                              lead_name: t.lead_name,
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
