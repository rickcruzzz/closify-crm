'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
import { Textarea } from '@/components/ui/textarea'
import {
  whatsappTemplateSchema,
  type WhatsAppTemplateFormInput,
  type WhatsAppTemplateFormValues,
} from '@/lib/validations/whatsapp-template'

export function SendWhatsAppTemplateDialog({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (values: WhatsAppTemplateFormValues) => void | Promise<void>
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WhatsAppTemplateFormInput, unknown, WhatsAppTemplateFormValues>({
    resolver: zodResolver(whatsappTemplateSchema),
    defaultValues: { nomeDoModelo: '', idioma: 'pt_BR', parametros: '' },
  })

  React.useEffect(() => {
    if (open) reset({ nomeDoModelo: '', idioma: 'pt_BR', parametros: '' })
  }, [open, reset])

  async function onSubmit(values: WhatsAppTemplateFormValues) {
    setIsSubmitting(true)
    try {
      await onSend(values)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar modelo do WhatsApp</DialogTitle>
          <DialogDescription>
            Só modelos já aprovados na sua conta Meta — a plataforma não permite texto livre
            para iniciar a conversa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nomeDoModelo">Nome do modelo</Label>
            <Input
              id="nomeDoModelo"
              placeholder="ex: boas_vindas_lead"
              aria-invalid={!!errors.nomeDoModelo}
              disabled={isSubmitting}
              {...register('nomeDoModelo')}
            />
            {errors.nomeDoModelo && (
              <p role="alert" className="text-destructive text-xs">
                {errors.nomeDoModelo.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idioma">Idioma do modelo</Label>
            <Input
              id="idioma"
              placeholder="pt_BR"
              aria-invalid={!!errors.idioma}
              disabled={isSubmitting}
              {...register('idioma')}
            />
            {errors.idioma && (
              <p role="alert" className="text-destructive text-xs">
                {errors.idioma.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="parametros">Parâmetros (um por linha, opcional)</Label>
            <Textarea
              id="parametros"
              rows={3}
              placeholder={'João\nAgência Pulso'}
              disabled={isSubmitting}
              {...register('parametros')}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
