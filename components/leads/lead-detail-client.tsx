'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Building2, Calendar, ListTodo, Mail, MessageCircle, Phone, Plus, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/page-header'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { LeadFormDialog } from '@/components/leads/lead-form-dialog'
import { DeleteLeadDialog } from '@/components/leads/delete-lead-dialog'
import { ActivityTimeline } from '@/components/leads/activity-timeline'
import { ActivityFormDialog } from '@/components/leads/activity-form-dialog'
import { SendEmailDialog } from '@/components/leads/send-email-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { TaskItem } from '@/components/tasks/task-item'
import { TaskFormDialog, type TarefaEmEdicao } from '@/components/tasks/task-form-dialog'
import { createActivity, deleteLead, updateLead } from '@/lib/leads/actions'
import { criarTarefa, concluirTarefa, excluirTarefa, atualizarTarefa } from '@/lib/tasks/actions'
import { enviarEmailViaGmail } from '@/lib/integrations/workflow-actions'
import { linkDoWhatsApp } from '@/lib/leads/whatsapp'
import type { TaskRow } from '@/lib/tasks/types'
import type { LeadRow, WorkspaceMember } from '@/lib/leads/queries'
import type { ActivityType } from '@/lib/leads/types'
import type { LeadFormValues } from '@/lib/validations/lead'
import type { TaskFormValues } from '@/lib/validations/task'
import type { ActivityFormValues } from '@/lib/validations/activity'
import type { EmailMessageFormValues } from '@/lib/validations/email'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

type ActivityRow = {
  id: string
  type: ActivityType
  description: string
  created_at: string
  // `author_id` decide quem pode editar o registro; a timeline compara com o
  // usuário da sessão.
  author_id: string | null
  author_name: string | null
}

export function LeadDetailClient({
  lead,
  activities,
  tasks,
  members,
  currentUserId,
  isAdmin,
}: {
  lead: LeadRow
  activities: ActivityRow[]
  tasks: TaskRow[]
  members: WorkspaceMember[]
  currentUserId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [excluindoLead, setExcluindoLead] = React.useState(false)
  const [activityFormOpen, setActivityFormOpen] = React.useState(false)
  const [emailFormOpen, setEmailFormOpen] = React.useState(false)
  const [taskFormOpen, setTaskFormOpen] = React.useState(false)
  const [tarefaEmEdicao, setTarefaEmEdicao] = React.useState<TarefaEmEdicao | null>(null)
  // Set porque a lista pode ter várias tarefas — travar UMA não deve travar
  // as outras. Cobre concluir e excluir com o mesmo controle, seguindo o
  // padrão `excluindo`/`agendandoNoCalendario` de `deal-detail-sheet.tsx`.
  const [tarefasPendentes, setTarefasPendentes] = React.useState<Set<string>>(new Set())

  // Um relógio só para a lista, nascido no cliente: o servidor da Vercel roda
  // em UTC e calcularia "atrasada" com três horas de erro.
  const [agora, setAgora] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setAgora(new Date())
  }, [])

  const whatsapp = linkDoWhatsApp(lead.phone)

  async function handleSave(values: LeadFormValues) {
    const result = await updateLead(lead.id, values)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Lead atualizado com sucesso.')
    setFormOpen(false)
    // Sem router.refresh(): updateLead já revalida '/leads/${lead.id}' —
    // a rota atual — e o Next aplica o RSC atualizado sozinho.
  }

  async function handleDelete() {
    if (excluindoLead) return
    setExcluindoLead(true)
    const result = await deleteLead(lead.id)
    if (result?.error) {
      setExcluindoLead(false)
      toast.error(result.error)
      return
    }
    toast.success('Lead excluído.')
    router.push('/leads')
  }

  async function handleSendEmail(values: EmailMessageFormValues) {
    const result = await enviarEmailViaGmail(lead.id, values)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('E-mail enviado.')
    // Sem router.refresh(): enviarEmailViaGmail já revalida '/leads/${lead.id}'.
  }

  async function handleCreateActivity(values: ActivityFormValues) {
    const result = await createActivity(lead.id, values)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Atividade registrada.')
    // Sem router.refresh(): createActivity já revalida '/leads/${lead.id}'.
  }

  async function salvarTarefa(values: TaskFormValues) {
    const resultado = tarefaEmEdicao
      ? await atualizarTarefa(tarefaEmEdicao.id, values)
      : await criarTarefa(values)

    if ('error' in resultado) {
      toast.error(resultado.error)
      return
    }

    toast.success(tarefaEmEdicao ? 'Tarefa atualizada.' : 'Tarefa criada.')
    setTarefaEmEdicao(null)
    // Sem router.refresh(): a tarefa aqui sempre carrega leadId = lead.id,
    // então revalidarTelasDeTarefa já revalida '/leads/${lead.id}'.
  }

  function marcarPendente(taskId: string) {
    setTarefasPendentes((atual) => new Set(atual).add(taskId))
  }

  function desmarcarPendente(taskId: string) {
    setTarefasPendentes((atual) => {
      const proximo = new Set(atual)
      proximo.delete(taskId)
      return proximo
    })
  }

  async function concluir(taskId: string) {
    if (tarefasPendentes.has(taskId)) return
    marcarPendente(taskId)

    const resultado = await concluirTarefa(taskId)

    if ('error' in resultado) {
      desmarcarPendente(taskId)
      toast.error(resultado.error)
      return
    }
    // Sem update otimista aqui: concluir grava uma atividade na timeline logo
    // ao lado, e as duas listas precisam mudar juntas. Deixar a tarefa sumir
    // antes da atividade aparecer mostraria um estado que nunca existiu.
    toast.success('Tarefa concluída.')
    // Sem router.refresh(): concluirTarefa já revalida '/leads/${lead.id}'
    // sempre que a tarefa concluída pertence a este lead — o caso de toda
    // tarefa listada aqui.
    //
    // E não desmarca `pendente` aqui de propósito: entre a Server Action
    // resolver e o RSC revalidado chegar (que vai marcar `done_at` e travar
    // o checkbox por conta própria), existe uma janela real onde um segundo
    // clique reabriria o envio — medido com clique duplo real, 908ms de
    // intervalo, disparando a action duas vezes. Ficar travado até a
    // revalidação chegar é seguro; travar para sempre em caso de erro não
    // seria, por isso só desmarca no erro.
  }

  async function excluir(taskId: string) {
    if (tarefasPendentes.has(taskId)) return
    marcarPendente(taskId)

    const resultado = await excluirTarefa(taskId)

    if ('error' in resultado) {
      desmarcarPendente(taskId)
      toast.error(resultado.error)
      return
    }
    toast.success('Tarefa excluída.')
    // Sem router.refresh(): idem. Mesma razão do `concluir` acima para não
    // desmarcar `pendente` no sucesso — a linha vai sumir da lista quando o
    // RSC revalidado chegar; até lá, travada é o comportamento seguro.
  }

  return (
    <div>
      <Link
        href="/leads"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Voltar para leads
      </Link>

      <PageHeader
        title={lead.name}
        description={lead.company ?? ''}
        actions={
          <>
            {/* Só aparece quando o telefone vira um link válido. `wa.me` com
                número torto abre uma tela de erro do WhatsApp, e quem clicou
                acha que o defeito é nosso. */}
            {whatsapp && (
              <Button
                variant="outline"
                render={
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" />
                    Chamar no WhatsApp
                  </a>
                }
              />
            )}
            {/* Só aparece com e-mail cadastrado — sem endereço, não há para
                onde mandar. Se o Gmail não estiver conectado, o erro vem do
                servidor ao tentar enviar, com o caminho pra Configurações. */}
            {lead.email && (
              <Button variant="outline" onClick={() => setEmailFormOpen(true)}>
                <Mail className="size-4" />
                Enviar e-mail
              </Button>
            )}
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              Editar
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Excluir
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <span className="text-muted-foreground mb-1.5 block text-xs">Status</span>
              <LeadStatusBadge status={lead.status} />
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Mail className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span className={lead.email ? "break-all" : "break-all text-muted-foreground"}>{lead.email ?? "Sem e-mail"}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Phone className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span className={lead.phone ? undefined : "text-muted-foreground"}>{lead.phone ?? "Sem telefone"}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Building2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>{lead.company}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <User className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>{lead.owner_name ?? 'Sem responsável'}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Calendar className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>Criado em {dateFormatter.format(new Date(lead.created_at))}</span>
            </div>

            <div className="border-t pt-4">
              <span className="text-muted-foreground mb-1 block text-xs">
                Valor estimado
              </span>
              <span className="text-lg font-semibold">
                {currencyFormatter.format(lead.value)}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Tarefas acima da timeline de propósito: o que falta fazer vale
              mais do que o que já foi feito, e enterrar as pendências abaixo
              do histórico faria a pessoa rolar para descobrir o que deve. */}
          <Card>
            <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Tarefas</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTarefaEmEdicao(null)
                  setTaskFormOpen(true)
                }}
              >
                <Plus className="size-4" />
                Nova tarefa
              </Button>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <EmptyState
                  icon={ListTodo}
                  size="sm"
                  title="Sem próxima ação"
                  description="Lead sem tarefa é lead que some. Agende o próximo passo agora."
                />
              ) : (
                <ul className="flex flex-col">
                  {tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      agora={agora ?? new Date(task.due_at)}
                      atrasada={
                        !task.done_at &&
                        agora !== null &&
                        new Date(task.due_at).getTime() < agora.getTime()
                      }
                      pendente={tarefasPendentes.has(task.id)}
                      onConcluir={concluir}
                      onEditar={(t) => {
                        setTarefaEmEdicao({
                          id: t.id,
                          title: t.title,
                          type: t.type,
                          due_at: t.due_at,
                          assignee_id: t.assignee_id,
                        })
                        setTaskFormOpen(true)
                      }}
                      onExcluir={excluir}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Timeline de atividades</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActivityFormOpen(true)}
              >
                Registrar atividade
              </Button>
            </CardHeader>
            <CardContent>
              <ActivityTimeline
                activities={activities}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={lead}
        members={members}
        onSave={handleSave}
      />

      <DeleteLeadDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        lead={lead}
        pending={excluindoLead}
        onConfirm={handleDelete}
      />

      <ActivityFormDialog
        open={activityFormOpen}
        onOpenChange={setActivityFormOpen}
        onCreate={handleCreateActivity}
      />

      {lead.email && (
        <SendEmailDialog
          open={emailFormOpen}
          onOpenChange={setEmailFormOpen}
          destinatario={lead.email}
          onSend={handleSendEmail}
        />
      )}

      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={(aberto) => {
          setTaskFormOpen(aberto)
          if (!aberto) setTarefaEmEdicao(null)
        }}
        onSubmit={salvarTarefa}
        members={members}
        currentUserId={currentUserId}
        leadId={lead.id}
        tarefa={tarefaEmEdicao}
      />
    </div>
  )
}
