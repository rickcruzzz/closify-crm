'use client'

import * as React from 'react'
import { ChevronRight, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TaskFormDialog } from '@/components/tasks/task-form-dialog'
import { listarTarefasVinculaveis, vincularTarefaAoNegocio } from '@/lib/tasks/actions'
import { taskTypeLabels } from '@/lib/tasks/types'
import type { ActivityType } from '@/lib/leads/types'
import type { WorkspaceMember } from '@/lib/leads/queries'
import type { DealStage } from '@/lib/deals/types'
import type { TaskFormValues } from '@/lib/validations/task'

type TarefaVinculavel = {
  id: string
  title: string
  type: ActivityType
  due_at: string
}

/**
 * Data e hora por extenso, para o botão dizer QUANDO sem depender de contexto.
 *
 * O nome acessível de cada item precisa carregar o prazo: na tela ele é texto
 * pequeno ao lado do título, e quem usa leitor de tela receberia só "Ligar para
 * confirmar" — três tarefas com títulos parecidos viram três botões idênticos.
 */
function quandoPorExtenso(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

/**
 * O diálogo da Próxima ação: escolher uma tarefa que já existe, ou criar.
 *
 * ## O defeito que isto fecha
 *
 * `getProximaAcaoPorNegocio` só enxerga tarefa com `deal_id`, e a página do
 * Contato nunca mandava esse campo. Então o painel do negócio dizia "Nenhuma
 * agendada" mesmo havendo tarefa aberta daquele contato, e oferecia o único
 * caminho que conhecia: criar outra. Duas tarefas para o mesmo compromisso, e
 * a pessoa só descobre quando as duas cobram.
 *
 * ## A etapa de escolha só existe quando há escolha
 *
 * Sem tarefa vinculável, este componente abre **direto** o formulário, igual a
 * antes. Uma tela intermediária dizendo "não há nada aqui, clique para criar"
 * seria um clique a mais no caso comum, cobrado de todo mundo para servir a
 * minoria — o oposto do que o pedido queria.
 *
 * ## Por que a lista é de `<button>`, e não de rádio com confirmação
 *
 * Escolher já É a ação: rádio mais "Confirmar" são dois passos para uma
 * decisão só. Botão dentro de `<li>` recebe foco, responde a `Tab` e `Enter`, e
 * não precisa de primitivo novo em `components/ui` — que só se gera pelo CLI
 * neste projeto.
 */
export function EscolherProximaAcao({
  open,
  onOpenChange,
  dealId,
  leadId,
  leadNome,
  stage,
  members,
  currentUserId,
  onCriar,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealId: string
  /** Sem contato vinculado não há tarefa para herdar: vai direto ao formulário. */
  leadId?: string | null
  leadNome?: string | null
  stage?: DealStage
  members: WorkspaceMember[]
  currentUserId: string
  onCriar: (values: TaskFormValues) => void | Promise<void>
}) {
  const [carregando, setCarregando] = React.useState(false)
  const [candidatas, setCandidatas] = React.useState<TarefaVinculavel[] | null>(null)
  const [criando, setCriando] = React.useState(false)
  const [vinculando, setVinculando] = React.useState<string | null>(null)

  // A busca acontece ao ABRIR, não na renderização do painel. `/kanban` é a
  // rota mais pesada do produto (o board carrega todos os negócios abertos), e
  // uma consulta por negócio no carregamento dela custaria em toda navegação
  // para servir um diálogo que quase nunca abre.
  React.useEffect(() => {
    if (!open) {
      setCandidatas(null)
      setCriando(false)
      setVinculando(null)
      return
    }

    if (!leadId) {
      setCandidatas([])
      setCriando(true)
      return
    }

    let cancelado = false
    setCarregando(true)

    void listarTarefasVinculaveis(leadId)
      .then(({ tarefas }) => {
        if (cancelado) return
        setCandidatas(tarefas as TarefaVinculavel[])
        // Nada para escolher: o formulário abre sozinho, sem clique a mais.
        setCriando(tarefas.length === 0)
        setCarregando(false)
      })
      // Rejeição deixava "Procurando tarefas abertas…" para sempre. Cair no
      // formulário é a saída certa: a pessoa clicou em Agendar querendo
      // agendar, e não poder LISTAR o que já existe não pode impedi-la de
      // criar. O aviso diz por que a lista não veio.
      .catch((err) => {
        if (cancelado) return
        console.error('listarTarefasVinculaveis falhou', err)
        setCandidatas([])
        setCarregando(false)
        setCriando(true)
        toast.error('Não deu para ver as tarefas que já existem. Você pode criar uma nova.')
      })

    return () => {
      cancelado = true
    }
  }, [open, leadId])

  async function usar(tarefa: TarefaVinculavel) {
    setVinculando(tarefa.id)
    const resultado = await vincularTarefaAoNegocio(tarefa.id, dealId)
    setVinculando(null)

    if ('error' in resultado) {
      toast.error(resultado.error)
      return
    }

    toast.success('Próxima ação definida.')
    onOpenChange(false)
  }

  // Formulário: o mesmo de sempre, com o negócio já preenchido.
  if (criando) {
    return (
      <TaskFormDialog
        open={open}
        onOpenChange={onOpenChange}
        onSubmit={onCriar}
        members={members}
        currentUserId={currentUserId}
        leadId={leadId}
        dealId={dealId}
        stage={stage}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Próxima ação</DialogTitle>
          <DialogDescription>
            {leadNome
              ? `${leadNome} já tem tarefa aberta. Use uma delas ou crie outra.`
              : 'Use uma tarefa que já existe ou crie outra.'}
          </DialogDescription>
        </DialogHeader>

        {carregando || candidatas === null ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Procurando tarefas abertas…
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {candidatas.map((tarefa) => (
              <li key={tarefa.id}>
                <button
                  type="button"
                  disabled={vinculando !== null}
                  onClick={() => void usar(tarefa)}
                  // O nome acessível carrega título, tipo E prazo: na tela o
                  // prazo é texto pequeno, e sem ele três tarefas de nome
                  // parecido viram três botões indistinguíveis no leitor.
                  aria-label={`Usar "${tarefa.title}", ${taskTypeLabels[tarefa.type]}, ${quandoPorExtenso(tarefa.due_at)}`}
                  className="border-border hover:bg-muted focus-visible:ring-ring flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{tarefa.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {taskTypeLabels[tarefa.type]} · {quandoPorExtenso(tarefa.due_at)}
                    </span>
                  </span>
                  {vinculando === tarefa.id ? (
                    <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3">
          <span className="border-border flex-1 border-t" />
          <span className="text-muted-foreground text-xs">ou</span>
          <span className="border-border flex-1 border-t" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full md:min-h-9"
          disabled={vinculando !== null}
          onClick={() => setCriando(true)}
        >
          <Plus className="size-4" />
          Criar uma tarefa nova
        </Button>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={vinculando !== null}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
