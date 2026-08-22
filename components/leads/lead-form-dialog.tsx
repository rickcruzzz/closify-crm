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
import {
  formatarMoedaBRL,
  formatarTelefoneBR,
  moedaParaNumero,
  numeroParaMoeda,
} from '@/lib/format-input'
import { leadStatusLabels, type LeadStatus } from '@/lib/leads/types'
import type { LeadRow } from '@/lib/leads/queries'
import type { WorkspaceMember } from '@/lib/leads/queries'
import {
  leadSchema,
  type LeadFormInput,
  type LeadFormValues,
} from '@/lib/validations/lead'

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  members,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: LeadRow
  members: WorkspaceMember[]
  onSave: (values: LeadFormValues, id?: string) => void | Promise<void>
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isEditing = !!lead

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<LeadFormInput, unknown, LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      company: '',
      status: 'novo',
      ownerId: members[0]?.id ?? '',
      value: 0,
    },
  })

  React.useEffect(() => {
    if (open) {
      reset(
        lead
          ? {
              name: lead.name,
              // Lead vindo de planilha de WhatsApp não tem e-mail. O campo
              // segue obrigatório no formulário manual, quem abre para editar
              // preenche,, mas o valor inicial precisa ser texto, não nulo.
              email: lead.email ?? '',
              phone: lead.phone ?? '',
              company: lead.company ?? '',
              status: lead.status,
              ownerId: lead.owner_id ?? members[0]?.id ?? '',
              value: lead.value,
            }
          : {
              name: '',
              email: '',
              phone: '',
              company: '',
              status: 'novo',
              ownerId: members[0]?.id ?? '',
              value: 0,
            },
      )
    }
  }, [open, lead, members, reset])

  async function onSubmit(values: LeadFormValues) {
    setIsSubmitting(true)
    try {
      await onSave(values, lead?.id)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar lead' : 'Novo lead'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações do lead.'
              : 'Cadastre um novo contato no seu funil.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              placeholder="Nome do lead"
              aria-invalid={!!errors.name}
              disabled={isSubmitting}
              {...register('name')}
            />
            {errors.name && (
              <p role="alert" className="text-destructive text-xs">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              {/* "ou telefone" no rótulo em vez de um asterisco de
                  obrigatório: a regra real é ter ALGUMA forma de falar com a
                  pessoa (constraint `leads_contato_minimo`, migration 0025), e
                  dizer isso aqui evita que alguém invente um e-mail só para
                  conseguir salvar um contato que chegou pelo WhatsApp. */}
              <Label htmlFor="email">
                E-mail
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  · ou telefone
                </span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="lead@empresa.com.br"
                aria-invalid={!!errors.email}
                disabled={isSubmitting}
                {...register('email')}
              />
              {errors.email && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">
                Telefone
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  · ou e-mail
                </span>
              </Label>
              {/* Formata enquanto digita: sem isso o campo aceitava
                  "71993309404" cru e cada lead ficava num formato diferente. */}
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <Input
                    id="phone"
                    inputMode="numeric"
                    placeholder="(11) 90000-0000"
                    aria-invalid={!!errors.phone}
                    disabled={isSubmitting}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(formatarTelefoneBR(e.target.value))}
                  />
                )}
              />
              {errors.phone && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              placeholder="Nome da empresa"
              aria-invalid={!!errors.company}
              disabled={isSubmitting}
              {...register('company')}
            />
            {errors.company && (
              <p role="alert" className="text-destructive text-xs">
                {errors.company.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue placeholder="Selecione">
                        {(value) => leadStatusLabels[value as LeadStatus]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(leadStatusLabels) as LeadStatus[]).map((status) => (
                        <SelectItem key={status} value={status}>
                          {leadStatusLabels[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.status.message}
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="value">Valor estimado (R$)</Label>
            {/* Máscara de moeda em vez de `type="number"`: digitar 1500 mostra
                "15,00" e vai formatando os milhares sozinho, como teclado de
                caixa. Antes o campo aceitava "1500" cru e não dava para saber
                se era mil e quinhentos ou quinze reais. */}
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

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Salvar alterações' : 'Criar lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
