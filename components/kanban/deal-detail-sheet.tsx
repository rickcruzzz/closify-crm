'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { AlarmClock, CalendarPlus, Loader2, Plus, Trash2 } from 'lucide-react'

import { dealStageLabels, dealStages, type DealStage } from '@/lib/deals/types'
import type { DealRow, DealLeadRow } from '@/lib/deals/queries'
import type { WorkspaceMember } from '@/lib/leads/queries'
import type { ProximaAcaoRow } from '@/lib/tasks/types'
import type { TaskFormValues } from '@/lib/validations/task'
import { criarTarefa, concluirTarefa } from '@/lib/tasks/actions'
import { agendarReuniaoNoGoogleCalendar } from '@/lib/integrations/workflow-actions'
import { deleteDeal } from '@/lib/deals/actions'
import { estadoDeMovimento, rotuloDeParado } from '@/lib/deals/parado'
import { ProximaAcao } from '@/components/kanban/proxima-acao'
import { TaskFormDialog } from '@/components/tasks/task-form-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: string | null) {
  if (!date) return 'Sem data'
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function DealDetailSheet({
  deal,
  lead,
  proximaAcao,
  members,
  currentUserId,
  calendarConectado,
  open,
  onOpenChange,
  onStageChange,
  onDeleted,
}: {
  deal: DealRow | undefined
  lead: DealLeadRow | undefined
  proximaAcao: ProximaAcaoRow | undefined
  members: WorkspaceMember[]
  currentUserId: string
  /** Se dá pra oferecer "mandar pro Google Calendar" — vem de Integrações. */
  calendarConectado: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onStageChange: (dealId: string, stage: DealStage) => void
  /** Avisa o board para tirar o card sem esperar o refresh do servidor. */
  onDeleted: (dealId: string) => void
}) {
  const [confirmando, setConfirmando] = React.useState(false)
  const [excluindo, setExcluindo] = React.useState(false)
  const [agendando, setAgendando] = React.useState(false)
  const [agendandoNoCalendario, setAgendandoNoCalendario] = React.useState(false)
  const [concluindo, setConcluindo] = React.useState(false)

  // Relógio do cliente: o servidor roda em UTC e erraria a virada do dia.
  const [agora, setAgora] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setAgora(new Date())
  }, [])

  const movimento = agora && deal ? estadoDeMovimento(deal, agora) : null

  async function agendar(values: TaskFormValues) {
    const resultado = await criarTarefa(values)

    if ('error' in resultado) {
      toast.error(resultado.error)
      return
    }

    toast.success('Próxima ação agendada.')
    // Sem router.refresh(): criarTarefa já revalida '/kanban' — a rota
    // atual —, e o Next aplica o RSC atualizado sozinho na resposta da
    // própria Server Action.
  }

  async function adicionarAoCalendario() {
    if (!proximaAcao) return
    setAgendandoNoCalendario(true)
    const resultado = await agendarReuniaoNoGoogleCalendar(proximaAcao.id)
    setAgendandoNoCalendario(false)

    if ('error' in resultado) {
      toast.error(resultado.error)
      return
    }

    toast.success('Evento criado no Google Calendar.')
    // Idem: a action já revalida '/kanban'.
  }

  async function concluir() {
    if (!proximaAcao || concluindo) return
    setConcluindo(true)
    const resultado = await concluirTarefa(proximaAcao.id)

    if ('error' in resultado) {
      setConcluindo(false)
      toast.error(resultado.error)
      return
    }

    toast.success('Tarefa concluída.')
    // Idem: concluirTarefa já revalida '/kanban'.
    // Não limpa `concluindo` aqui de propósito: entre a Server Action
    // resolver e o RSC revalidado chegar (o que vai trocar/esconder este
    // botão), existe uma janela real onde um segundo clique reabriria o
    // envio — medido com clique duplo real, que disparou a action duas
    // vezes. Deixar travado até a revalidação chegar é seguro; travar para
    // sempre em caso de erro não seria, por isso só limpa no erro.
  }

  async function handleExcluir() {
    if (!deal) return
    setExcluindo(true)
    const r = await deleteDeal(deal.id)
    setExcluindo(false)

    if (r?.error) {
      toast.error(r.error)
      return
    }

    toast.success('Negócio excluído.')
    setConfirmando(false)
    onOpenChange(false)
    onDeleted(deal.id)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {deal && (
          <>
            <SheetHeader>
              <SheetTitle>{deal.title}</SheetTitle>
              {lead && <SheetDescription>{lead.company}</SheetDescription>}
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4">
              <div>
                <span className="text-muted-foreground text-xs">Valor do negócio</span>
                <p className="text-xl font-semibold">{formatBRL(deal.value)}</p>
              </div>

              <Separator />

              <div>
                <span className="text-muted-foreground text-xs">Etapa</span>
                <Select
                  value={deal.stage}
                  onValueChange={(value) => onStageChange(deal.id, value as DealStage)}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue>
                      {(value) => dealStageLabels[value as DealStage]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {dealStages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {dealStageLabels[stage]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {lead && (
                <div>
                  <span className="text-muted-foreground text-xs">Lead vinculado</span>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-muted-foreground text-xs">{lead.email}</p>
                  <p className="text-muted-foreground text-xs">{lead.phone}</p>
                </div>
              )}

              <div>
                <span className="text-muted-foreground text-xs">Responsável</span>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(deal.owner_name ?? '?')}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{deal.owner_name ?? 'Sem responsável'}</span>
                </div>
              </div>

              <div className="flex justify-between">
                <div>
                  {/* O prazo saiu do card do Kanban e mora aqui: ele é
                      previsão de fechamento, não ordem do dia. O card mostra a
                      próxima ação, que é o que dá para cumprir hoje. */}
                  <span className="text-muted-foreground text-xs">Prazo</span>
                  <p className="text-sm">{formatDate(deal.due_date)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Criado em</span>
                  <p className="text-sm">{formatDate(deal.created_at)}</p>
                </div>
              </div>

              {/* Há quanto tempo o negócio não muda de etapa. Fica aqui e não
                  no card: lá já mora a próxima ação, e duas datas competindo
                  fazem a pessoa não saber qual obedecer — a mesma razão pela
                  qual o prazo saiu de lá. */}
              <div>
                <span className="text-muted-foreground text-xs">Movimento</span>
                {movimento === null ? (
                  <p className="text-muted-foreground text-sm">Calculando…</p>
                ) : movimento.parado ? (
                  <p className="text-destructive flex items-center gap-1.5 text-sm font-medium">
                    <AlarmClock aria-hidden className="size-4 shrink-0" />
                    {rotuloDeParado(movimento.dias)}
                  </p>
                ) : (
                  <p className="text-sm">
                    {movimento.dias === 0
                      ? 'Mudou de etapa hoje'
                      : movimento.dias === 1
                        ? 'Mudou de etapa ontem'
                        : `Na mesma etapa há ${movimento.dias} dias`}
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <span className="text-muted-foreground text-xs">Próxima ação</span>

                {proximaAcao ? (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {proximaAcao.title}
                      </span>
                      <ProximaAcao task={proximaAcao} />
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {/* Ícone sozinho, antes, dependia só do `title` (tooltip)
                          pra alguém entender o que o botão faz — igual ao
                          Gmail (`lead-detail-client.tsx`) já é ícone + texto,
                          este passa a ser também. */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={agendandoNoCalendario}
                        onClick={adicionarAoCalendario}
                      >
                        {agendandoNoCalendario ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CalendarPlus className="size-4" />
                        )}
                        Google Calendar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={concluindo}
                        onClick={concluir}
                      >
                        {concluindo && <Loader2 className="size-4 animate-spin" />}
                        Concluir
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-sm">
                        Nenhuma agendada.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAgendando(true)}
                      >
                        <Plus className="size-4" />
                        Agendar
                      </Button>
                    </div>
                    {/* Só quando o Calendar está conectado — sem isso a dica
                        prometeria um botão que ainda não vai aparecer depois
                        de agendar. Prepara quem tá vendo pela primeira vez:
                        quando o botão de verdade surgir (depois de agendar),
                        já não é surpresa. */}
                    {calendarConectado && (
                      <p className="text-muted-foreground text-xs">
                        Depois de agendar, dá pra mandar direto pro Google Calendar.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* A exclusão vive aqui, e não no card do Kanban: no card ela
                ficaria a um clique de distância do arrastar, e apagar negócio
                por engano não tem desfazer. */}
            <SheetFooter className="sm:justify-between">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={excluindo}
                onClick={() => setConfirmando(true)}
              >
                {excluindo ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Excluir negócio
              </Button>
              <SheetClose render={<Button variant="outline" />}>Fechar</SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>

      {/* A tarefa nasce presa ao negócio E ao lead dele. Só ao negócio faria
          ela sumir da página do cliente, que é onde a pessoa vai procurar. */}
      <TaskFormDialog
        open={agendando}
        onOpenChange={setAgendando}
        onSubmit={agendar}
        members={members}
        currentUserId={currentUserId}
        dealId={deal?.id ?? null}
        leadId={deal?.lead_id ?? null}
      />

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir este negócio?</DialogTitle>
            <DialogDescription>
              {deal?.title
                ? `"${deal.title}" sai do funil em definitivo. O lead vinculado continua cadastrado.`
                : 'O negócio sai do funil em definitivo.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setConfirmando(false)}
              disabled={excluindo}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={excluindo}>
              {excluindo && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
