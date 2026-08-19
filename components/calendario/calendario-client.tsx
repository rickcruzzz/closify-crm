'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, LayoutList, CalendarDays, Rows3 } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { MonthView } from '@/components/calendario/month-view'
import { WeekView } from '@/components/calendario/week-view'
import { AgendaView } from '@/components/calendario/agenda-view'
import { TaskFormDialog, type TarefaEmEdicao } from '@/components/tasks/task-form-dialog'
import { agruparTarefasPorDia } from '@/lib/calendario/agrupar-por-dia'
import { rotuloDoMes } from '@/lib/calendario/grade-do-mes'
import { diasDaSemana } from '@/lib/calendario/semana'
import { diaEmSaoPaulo } from '@/lib/tasks/buckets'
import { atualizarTarefa, buscarTarefasNoIntervalo, concluirTarefa } from '@/lib/tasks/actions'
import { avisarTarefaConcluida } from '@/lib/tasks/avisar-concluida'
import type { TaskRow } from '@/lib/tasks/types'
import type { WorkspaceMember } from '@/lib/leads/queries'
import type { TaskFormValues } from '@/lib/validations/task'

type Modo = 'mes' | 'semana' | 'agenda'

const MODOS: { valor: Modo; rotulo: string; icone: typeof CalendarDays }[] = [
  { valor: 'mes', rotulo: 'Mês', icone: CalendarDays },
  { valor: 'semana', rotulo: 'Semana', icone: Rows3 },
  { valor: 'agenda', rotulo: 'Agenda', icone: LayoutList },
]

export function CalendarioClient({
  tasks: tasksIniciais,
  members,
  currentUserId,
  ano: anoInicial,
  mes: mesInicial,
  desdeCarregado,
  ateCarregado,
}: {
  tasks: TaskRow[]
  members: WorkspaceMember[]
  currentUserId: string
  ano: number
  mes: number
  desdeCarregado: string
  ateCarregado: string
}) {
  const router = useRouter()

  // Agenda é o padrão mais seguro no mobile: leitura rápida, sem tentar
  // encolher uma grade de mês pra caber numa tela estreita. `useMediaQuery`
  // devolve `false` no primeiro render sempre (evita mismatch de hidratação),
  // então `ehMobile` começa `true` mesmo no desktop — usar isso direto no
  // `useState` travaria todo mundo em Agenda até o usuário trocar de aba na
  // mão. O modo padrão só é decidido uma vez, DIRETO por `window.matchMedia`
  // dentro de um efeito que roda só na montagem (nunca no servidor, então
  // reflete a tela real de saída) — depois disso não mexe mais, pra não
  // sobrescrever uma troca manual de modo que a pessoa já tenha feito.
  const [modo, setModo] = React.useState<Modo>('agenda')
  React.useEffect(() => {
    if (!window.matchMedia('(min-width: 640px)').matches) return
    setModo('mes')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [ano, setAno] = React.useState(anoInicial)
  const [mes, setMes] = React.useState(mesInicial)
  const [diaAncoraSemana, setDiaAncoraSemana] = React.useState(() => diaEmSaoPaulo(new Date()))
  const [tasks, setTasks] = React.useState(tasksIniciais)
  const [emEdicao, setEmEdicao] = React.useState<TarefaEmEdicao | null>(null)
  const [buscandoSemana, setBuscandoSemana] = React.useState(false)

  React.useEffect(() => {
    setTasks(tasksIniciais)
  }, [tasksIniciais])

  // Modo Semana pode navegar para fora dos 42 dias que a página carregou de
  // início (a grade do mês corrente). Quando isso acontece, busca do
  // servidor e mescla no estado por id, sem descartar o que já tinha —
  // navegar de volta para dentro do mês não pode perder o que foi carregado
  // primeiro.
  React.useEffect(() => {
    if (modo !== 'semana') return

    const dias = diasDaSemana(diaAncoraSemana)
    const primeiroDia = dias[0]!
    const ultimoDia = dias[6]!
    const foraDoIntervalo = primeiroDia < desdeCarregado || ultimoDia > ateCarregado

    if (!foraDoIntervalo) return

    let cancelado = false
    setBuscandoSemana(true)

    buscarTarefasNoIntervalo(primeiroDia, ultimoDia).then((resultado) => {
      if (cancelado) return
      setBuscandoSemana(false)

      if ('error' in resultado) {
        toast.error(resultado.error)
        return
      }

      setTasks((atual) => {
        const porId = new Map(atual.map((t) => [t.id, t]))
        for (const task of resultado.tasks) porId.set(task.id, task)
        return Array.from(porId.values())
      })
    })

    return () => {
      cancelado = true
    }
  }, [modo, diaAncoraSemana, desdeCarregado, ateCarregado])

  // Mesmo relógio único de /hoje: `new Date()` dentro de cada chip faria
  // itens da MESMA tela discordarem sobre o que é "atrasado" ao cruzar o
  // minuto, e nasce no cliente porque o servidor da Vercel está em UTC.
  const [agora, setAgora] = React.useState<Date | null>(null)
  React.useEffect(() => {
    setAgora(new Date())
    const timer = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const tarefasPorDia = React.useMemo(() => agruparTarefasPorDia(tasks), [tasks])

  function navegarMes(direcao: -1 | 1) {
    const data = new Date(Date.UTC(ano, mes - 1 + direcao, 1))
    const novoAno = data.getUTCFullYear()
    const novoMes = data.getUTCMonth() + 1
    setAno(novoAno)
    setMes(novoMes)
    router.push(`/calendario?ano=${novoAno}&mes=${novoMes}`)
  }

  function abrirEvento(task: TaskRow) {
    setEmEdicao({
      id: task.id,
      title: task.title,
      type: task.type,
      due_at: task.due_at,
      assignee_id: task.assignee_id,
    })
  }

  // Semana, e não Agenda. O botão promete "as tarefas DESTE dia", e a Agenda
  // lista o período carregado inteiro (`agenda-view.tsx` percorre `tasks`, sem
  // filtrar por dia) — clicar em "+1" no dia 20 devolvia agosto todo, e o
  // `diaAncoraSemana` que acabou de ser setado nem era lido nesse modo. A
  // Semana usa a âncora de verdade e mostra todos os chips do dia sem corte,
  // que é exatamente o que o botão oferece.
  function verMaisNoDia(dia: string) {
    setDiaAncoraSemana(dia)
    setModo('semana')
  }

  async function concluir(taskId: string) {
    const anterior = tasks
    setTasks((atual) =>
      atual.map((t) => (t.id === taskId ? { ...t, done_at: new Date().toISOString() } : t)),
    )

    const resultado = await concluirTarefa(taskId)

    if ('error' in resultado) {
      setTasks(anterior)
      toast.error(resultado.error)
      return
    }

    // Mesma proteção de `/hoje`: o chip do calendário é ainda menor que a
    // linha da lista, e concluir por engano no celular era irreversível pela
    // tela. Desfazer aqui limpa o `done_at` local antes de revalidar, senão o
    // chip continuaria cinza e riscado até o RSC chegar.
    avisarTarefaConcluida(taskId, () => {
      setTasks((atual) => atual.map((t) => (t.id === taskId ? { ...t, done_at: null } : t)))
      router.refresh()
    })
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendário"
        description="O que aconteceu e o que vem por aí, tudo num lugar."
        actions={
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {MODOS.map(({ valor, rotulo, icone: Icone }) => (
              <Button
                key={valor}
                type="button"
                size="sm"
                variant={modo === valor ? 'default' : 'ghost'}
                onClick={() => setModo(valor)}
              >
                <Icone aria-hidden className="size-4" />
                {rotulo}
              </Button>
            ))}
          </div>
        }
      />

      {modo !== 'agenda' && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Período anterior"
            onClick={() =>
              modo === 'mes'
                ? navegarMes(-1)
                : setDiaAncoraSemana((d) => {
                    const [a, m, dd] = d.split('-').map(Number) as [number, number, number]
                    const nova = new Date(Date.UTC(a, m - 1, dd - 7))
                    return nova.toISOString().slice(0, 10)
                  })
            }
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            {modo === 'mes' ? rotuloDoMes(ano, mes) : `Semana de ${diaAncoraSemana}`}
            {buscandoSemana && <span className="text-muted-foreground"> · carregando…</span>}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Próximo período"
            onClick={() =>
              modo === 'mes'
                ? navegarMes(1)
                : setDiaAncoraSemana((d) => {
                    const [a, m, dd] = d.split('-').map(Number) as [number, number, number]
                    const nova = new Date(Date.UTC(a, m - 1, dd + 7))
                    return nova.toISOString().slice(0, 10)
                  })
            }
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      {agora && (
        <>
          {modo === 'mes' && (
            <MonthView
              ano={ano}
              mes={mes}
              onNavegarMes={navegarMes}
              tarefasPorDia={tarefasPorDia}
              agora={agora}
              onSelecionarTarefa={abrirEvento}
              onVerMais={verMaisNoDia}
            />
          )}
          {modo === 'semana' && (
            <WeekView
              diaAncora={diaAncoraSemana}
              tarefasPorDia={tarefasPorDia}
              agora={agora}
              onSelecionarTarefa={abrirEvento}
            />
          )}
          {modo === 'agenda' && (
            <AgendaView
              tasks={tasks}
              agora={agora}
              onConcluir={concluir}
              onSelecionarTarefa={abrirEvento}
            />
          )}
        </>
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
