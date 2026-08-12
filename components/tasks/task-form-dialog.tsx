'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ActivityType } from '@/lib/leads/types'
import type { WorkspaceMember } from '@/lib/leads/queries'
import { taskTypeLabels } from '@/lib/tasks/types'
import { taskSchema, type TaskFormInput, type TaskFormValues } from '@/lib/validations/task'

/**
 * O valor que o `<input type="datetime-local">` espera: `YYYY-MM-DDTHH:mm` no
 * fuso de quem está olhando.
 *
 * `toISOString()` aqui daria o horário em UTC e o campo abriria três horas
 * adiantado. A conta com `getTimezoneOffset` desloca o instante para que o
 * corte da string caia no horário local.
 */
function paraCampoLocal(data: Date): string {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** Amanhã às 9h — o padrão que quase todo follow-up de venda quer. */
function sugestaoDePrazo(): string {
  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  amanha.setHours(9, 0, 0, 0)
  return paraCampoLocal(amanha)
}

export type TarefaEmEdicao = {
  id: string
  title: string
  type: ActivityType
  due_at: string
  assignee_id: string | null
}

export function TaskFormDialog({
  open,
  onOpenChange,
  onSubmit: onSubmitProp,
  members,
  currentUserId,
  leadId,
  dealId,
  tarefa,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: TaskFormValues) => void | Promise<void>
  members: WorkspaceMember[]
  currentUserId: string
  /** A tarefa nasce presa a um lead ou a um negócio — o banco exige um dos dois. */
  leadId?: string | null
  dealId?: string | null
  /** Presente: o diálogo edita em vez de criar. */
  tarefa?: TarefaEmEdicao | null
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskSchema),
  })

  React.useEffect(() => {
    if (!open) return

    reset({
      title: tarefa?.title ?? '',
      type: tarefa?.type ?? 'ligacao',
      dueAt: tarefa ? paraCampoLocal(new Date(tarefa.due_at)) : sugestaoDePrazo(),
      assigneeId: tarefa?.assignee_id ?? currentUserId,
      leadId: leadId ?? null,
      dealId: dealId ?? null,
    })
  }, [open, reset, tarefa, currentUserId, leadId, dealId])

  async function submeter(values: TaskFormValues) {
    setIsSubmitting(true)
    try {
      await onSubmitProp(values)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tarefa ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
          <DialogDescription>
            O que precisa ser feito, e quando. Ela aparece na tela Hoje e no card do
            negócio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submeter)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">O que fazer</Label>
            <Input
              id="task-title"
              placeholder="Ligar para confirmar a proposta"
              aria-invalid={!!errors.title}
              disabled={isSubmitting}
              {...register('title')}
            />
            {errors.title && (
              <p role="alert" className="text-destructive text-xs">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-type">Tipo</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="task-type" className="w-full">
                      <SelectValue placeholder="Selecione">
                        {(value) => taskTypeLabels[value as ActivityType]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(taskTypeLabels) as ActivityType[]).map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {taskTypeLabels[tipo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due">Quando</Label>
              <Input
                id="task-due"
                type="datetime-local"
                aria-invalid={!!errors.dueAt}
                disabled={isSubmitting}
                {...register('dueAt')}
              />
              {errors.dueAt && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.dueAt.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-assignee">Responsável</Label>
            <Controller
              name="assigneeId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="task-assignee" className="w-full">
                    <SelectValue placeholder="Selecione">
                      {(value) =>
                        members.find((m) => m.id === value)?.name ?? 'Selecione'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((membro) => (
                      <SelectItem key={membro.id} value={membro.id}>
                        {membro.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.assigneeId && (
              <p role="alert" className="text-destructive text-xs">
                {errors.assigneeId.message}
              </p>
            )}
          </div>

          {/* O erro do refine `tasks_alvo_minimo` pousa em `leadId`. Ele só
              aparece se a tarefa chegar sem lead e sem negócio, o que a tela
              não deixa acontecer — mas se acontecer, a pessoa precisa ler o
              motivo em vez de ver o botão não fazer nada. */}
          {errors.leadId && (
            <p role="alert" className="text-destructive text-xs">
              {errors.leadId.message}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {tarefa ? 'Salvar' : 'Criar tarefa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
