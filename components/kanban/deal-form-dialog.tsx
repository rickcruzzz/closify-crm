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
import { mockLeads } from '@/lib/leads/mock-data'
import type { Lead } from '@/lib/leads/types'
import {
  dealSchema,
  type DealFormInput,
  type DealFormValues,
} from '@/lib/validations/deal'

const owners = ['Rick Cruz', 'Ana Paula']

const leadsById = new Map(mockLeads.map((lead) => [lead.id, lead] as [string, Lead]))

export function DealFormDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (values: DealFormValues) => void
}) {
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
      owner: owners[0],
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
        owner: owners[0],
        dueDate: '',
      })
    }
  }, [open, reset])

  function onSubmit(values: DealFormValues) {
    setIsSubmitting(true)
    setTimeout(() => {
      onCreate(values)
      setIsSubmitting(false)
      onOpenChange(false)
    }, 500)
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
              <p className="text-destructive text-xs">{errors.title.message}</p>
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
                    {mockLeads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name} — {lead.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.leadId && (
              <p className="text-destructive text-xs">{errors.leadId.message}</p>
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
                <p className="text-destructive text-xs">{errors.stage.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner">Responsável</Label>
              <Controller
                name="owner"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="owner" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((owner) => (
                        <SelectItem key={owner} value={owner}>
                          {owner}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.owner && (
                <p className="text-destructive text-xs">{errors.owner.message}</p>
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
                <p className="text-destructive text-xs">{errors.value.message}</p>
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
                <p className="text-destructive text-xs">{errors.dueDate.message}</p>
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
