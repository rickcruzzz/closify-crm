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
import { dealStageLabels, dealStages, type DealStage } from '@/lib/deals/types'
import type { DealLeadRow } from '@/lib/deals/queries'
import type { WorkspaceMember } from '@/lib/leads/queries'
import {
  dealSchema,
  type DealFormInput,
  type DealFormValues,
} from '@/lib/validations/deal'

export function DealFormDialog({
  open,
  onOpenChange,
  onCreate,
  leads,
  members,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (values: DealFormValues) => void | Promise<void>
  leads: DealLeadRow[]
  members: WorkspaceMember[]
}) {
  const leadsById = React.useMemo(
    () => new Map(leads.map((lead) => [lead.id, lead])),
    [leads],
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<DealFormInput, unknown, DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: '',
      leadId: '',
      value: 0,
      stage: 'novo',
      ownerId: members[0]?.id ?? '',
      dueDate: '',
    },
  })

  React.useEffect(() => {
    if (open) {
      reset({
        title: '',
        leadId: '',
        value: 0,
        stage: 'novo',
        ownerId: members[0]?.id ?? '',
        dueDate: '',
      })
    }
  }, [open, members, reset])

  async function onSubmit(values: DealFormValues) {
    setIsSubmitting(true)
    try {
      await onCreate(values)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo negócio</DialogTitle>
          <DialogDescription>Cadastre um novo negócio no seu pipeline.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título do negócio</Label>
            <Input
              id="title"
              placeholder="Ex: Plano anual — Agência Nova Era"
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leadId">Lead vinculado</Label>
            <Controller
              name="leadId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="leadId" className="w-full">
                    <SelectValue placeholder="Selecione um lead">
                      {(value) => {
                        const lead = leadsById.get(value as string)
                        return lead ? `${lead.name} — ${lead.company}` : value
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name} — {lead.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.leadId && (
              <p role="alert" className="text-destructive text-xs">
                {errors.leadId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stage">Etapa</Label>
              <Controller
                name="stage"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="stage" className="w-full">
                      <SelectValue placeholder="Selecione">
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
                )}
              />
              {errors.stage && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.stage.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ownerId">Responsável</Label>
              <Controller
                name="ownerId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="ownerId" className="w-full">
                      <SelectValue placeholder="Selecione">
                        {(value) =>
                          members.find((m) => m.id === value)?.name ?? 'Selecione'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.ownerId && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.ownerId.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="value">Valor (R$)</Label>
              <Input
                id="value"
                type="number"
                min={0}
                step="0.01"
                aria-invalid={!!errors.value}
                disabled={isSubmitting}
                {...register('value')}
              />
              {errors.value && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.value.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Prazo</Label>
              <Input
                id="dueDate"
                type="date"
                aria-invalid={!!errors.dueDate}
                disabled={isSubmitting}
                {...register('dueDate')}
              />
              {errors.dueDate && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.dueDate.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Criar negócio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
