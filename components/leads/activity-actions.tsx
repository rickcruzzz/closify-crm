'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { deleteActivity, updateActivity } from '@/lib/leads/actions'
import {
  activitySchema,
  type ActivityFormInput,
  type ActivityFormValues,
} from '@/lib/validations/activity'
import type { ActivityType } from '@/lib/leads/types'

const TIPOS: { valor: ActivityType; rotulo: string }[] = [
  { valor: 'ligacao', rotulo: 'Ligação' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'reuniao', rotulo: 'Reunião' },
  { valor: 'nota', rotulo: 'Nota' },
]

/**
 * Editar e excluir uma atividade da timeline.
 *
 * Isolado num componente cliente para a `ActivityTimeline` continuar sendo
 * Server Component, só este menu precisa de estado, e transformar a lista
 * inteira em cliente mandaria todo o histórico para o bundle.
 *
 * Quem não é autor nem admin não vê o menu. A action recusa de qualquer forma;
 * esconder aqui evita oferecer uma ação que vai falhar.
 */
export function ActivityActions({
  activityId,
  tipoAtual,
  descricaoAtual,
  podeEditar,
}: {
  activityId: string
  tipoAtual: ActivityType
  descricaoAtual: string
  podeEditar: boolean
}) {
  const router = useRouter()
  const [editando, setEditando] = React.useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = React.useState(false)
  const [salvando, setSalvando] = React.useState(false)
  const [excluindo, setExcluindo] = React.useState(false)

  const { control, handleSubmit, reset, formState } = useForm<
    ActivityFormInput,
    unknown,
    ActivityFormValues
  >({
    resolver: zodResolver(activitySchema),
    defaultValues: { type: tipoAtual, description: descricaoAtual },
  })

  if (!podeEditar) return null

  async function salvar(values: ActivityFormValues) {
    setSalvando(true)
    const r = await updateActivity(activityId, values)
    setSalvando(false)
    if (r?.error) {
      toast.error(r.error)
      return
    }
    toast.success('Atividade atualizada.')
    setEditando(false)
    router.refresh()
  }

  async function excluir() {
    setExcluindo(true)
    const r = await deleteActivity(activityId)
    setExcluindo(false)
    if (r?.error) {
      toast.error(r.error)
      return
    }
    toast.success('Atividade excluída.')
    setConfirmandoExclusao(false)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Ações da atividade">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              reset({ type: tipoAtual, description: descricaoAtual })
              setEditando(true)
            }}
          >
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmandoExclusao(true)}
          >
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar atividade</DialogTitle>
            <DialogDescription>
              Corrija o tipo ou o texto do registro.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(salvar)} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`tipo-${activityId}`}>Tipo</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={salvando}
                  >
                    <SelectTrigger id={`tipo-${activityId}`} className="w-full">
                      <SelectValue placeholder="Selecione">
                        {(v) => TIPOS.find((t) => t.valor === v)?.rotulo ?? 'Selecione'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.valor} value={t.valor}>
                          {t.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {formState.errors.type && (
                <p role="alert" className="text-destructive text-xs">
                  {formState.errors.type.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`desc-${activityId}`}>Descrição</Label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Textarea
                    id={`desc-${activityId}`}
                    rows={4}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    disabled={salvando}
                    aria-invalid={!!formState.errors.description}
                  />
                )}
              />
              {formState.errors.description && (
                <p role="alert" className="text-destructive text-xs">
                  {formState.errors.description.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={salvando}>
                {salvando && <Loader2 className="size-4 animate-spin" />}
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmandoExclusao} onOpenChange={setConfirmandoExclusao}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir esta atividade?</DialogTitle>
            <DialogDescription>
              O registro sai da timeline do lead em definitivo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setConfirmandoExclusao(false)}
              disabled={excluindo}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluir} disabled={excluindo}>
              {excluindo && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
