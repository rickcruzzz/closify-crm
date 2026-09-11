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
          <DialogTitle>{isEditing ? 'Editar contato' : 'Novo contato'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações do contato.'
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
              placeholder="Nome do contato"
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

          {/* `grid-cols-1 sm:grid-cols-2`, não `grid-cols-2` fixo: em 390px de
              largura, duas colunas sobram ~170px cada uma, e o placeholder
              "contato@empresa.com.br" corta antes do fim ("contato@empresa.c").
              Empilha até `sm` (640px), onde cada campo já cabe inteiro. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              {/* ## O "· ou telefone" saiu do rótulo, e a regra desceu
                  para uma linha só

                  A intenção estava certa e a execução confundia: cada rótulo
                  apontava para o outro campo, então "E-mail · ou telefone" ao
                  lado de "Telefone · ou e-mail" obrigava a ler os dois e
                  deduzir a regra — que é "um dos dois basta".

                  Relatado pelo dono olhando a tela. A regra continua sendo a
                  mesma (`leads_contato_minimo`, migration 0025) e continua
                  dita, uma vez, abaixo dos dois campos, onde ela descreve o
                  PAR em vez de cada metade. */}
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="contato@empresa.com.br"
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
              <Label htmlFor="phone">Telefone</Label>
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

          {/* A regra dita uma vez, sobre o PAR — em vez de cada rótulo
              apontando para o outro campo.

              `-mt-1` porque a grade acima já tem `gap-3`: sem isso a linha
              flutuaria longe demais dos campos que ela descreve e leria como
              observação de outra coisa. */}
          <p className="text-muted-foreground -mt-1 text-xs">
            Preencha o e-mail ou o telefone — um dos dois basta.
          </p>

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

          {/* `grid-cols-1 sm:grid-cols-2`, não `grid-cols-2` fixo: em 390px de
              largura, duas colunas sobram ~170px cada uma, e o placeholder
              "contato@empresa.com.br" corta antes do fim ("contato@empresa.c").
              Empilha até `sm` (640px), onde cada campo já cabe inteiro. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              {isEditing ? 'Salvar alterações' : 'Criar contato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
