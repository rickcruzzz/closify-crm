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
  formatarMoedaBRL,
  moedaParaNumero,
  numeroParaMoeda,
} from '@/lib/format-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/ui/combobox'
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
          <DialogDescription>Cadastre um novo negócio no seu funil.</DialogDescription>
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
              placeholder="Ex: Plano anual da Agência Nova Era"
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
            {/* `Combobox`, não `Select`: workspace com muitos leads fazia a
                pessoa rolar a lista inteira procurando pelo nome, sem filtro
                nenhum. O item é o próprio `DealLeadRow`; `itemToStringValue`
                é o que vira `leadId` no formulário — o combobox trata objeto
                como valor de verdade, string é só a exibição. */}
            <Controller
              name="leadId"
              control={control}
              render={({ field }) => (
                <Combobox
                  items={leads}
                  itemToStringLabel={(lead) => `${lead.name} (${lead.company})`}
                  itemToStringValue={(lead) => lead.id}
                  value={leadsById.get(field.value) ?? null}
                  onValueChange={(lead) => field.onChange(lead?.id ?? '')}
                  disabled={isSubmitting}
                >
                  <ComboboxTrigger id="leadId">
                    <ComboboxValue placeholder="Selecione um lead">
                      {(lead: DealLeadRow | null) =>
                        lead ? `${lead.name} (${lead.company})` : 'Selecione um lead'
                      }
                    </ComboboxValue>
                  </ComboboxTrigger>
                  <ComboboxContent>
                    <ComboboxInput placeholder="Buscar lead..." />
                    <ComboboxEmpty>Nenhum lead encontrado.</ComboboxEmpty>
                    <ComboboxList>
                      {(lead: DealLeadRow) => (
                        <ComboboxItem key={lead.id} value={lead}>
                          {lead.name} ({lead.company})
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
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
              {/* Mesma máscara do formulário de lead: formata os milhares
                  durante a digitação, com os dois últimos dígitos sempre nos
                  centavos. */}
              <Controller
                name="value"
                control={control}
                render={({ field }) => (
                  <Input
                    id="value"
                    inputMode="numeric"
                    placeholder="0,00"
                    aria-invalid={!!errors.value}
                    disabled={isSubmitting}
                    value={
                      typeof field.value === 'number'
                        ? numeroParaMoeda(field.value)
                        : formatarMoedaBRL(String(field.value ?? ''))
                    }
                    onChange={(e) =>
                      field.onChange(moedaParaNumero(formatarMoedaBRL(e.target.value)))
                    }
                  />
                )}
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
                // O seletor nativo aceita qualquer ano quando digitado pelo
                // teclado. `min`/`max` fazem o próprio navegador barrar antes
                // do submit, o zod cobre o resto, para quem contornar a UI.
                min="2000-01-01"
                max="2100-12-31"
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
