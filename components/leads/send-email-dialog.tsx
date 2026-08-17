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
  emailMessageSchema,
  type EmailMessageFormInput,
  type EmailMessageFormValues,
} from '@/lib/validations/email'

export function SendEmailDialog({
  open,
  onOpenChange,
  destinatario,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Só para mostrar pra quem vai, o e-mail de verdade sai do lead no servidor. */
  destinatario: string
  onSend: (values: EmailMessageFormValues) => void | Promise<void>
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmailMessageFormInput, unknown, EmailMessageFormValues>({
    resolver: zodResolver(emailMessageSchema),
    defaultValues: { assunto: '', corpo: '' },
  })

  React.useEffect(() => {
    if (open) reset({ assunto: '', corpo: '' })
  }, [open, reset])

  async function onSubmit(values: EmailMessageFormValues) {
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
          <DialogTitle>Enviar e-mail</DialogTitle>
          <DialogDescription>Para {destinatario}, pelo Gmail conectado.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assunto">Assunto</Label>
            <Input
              id="assunto"
              aria-invalid={!!errors.assunto}
              disabled={isSubmitting}
              {...register('assunto')}
            />
            {errors.assunto && (
              <p role="alert" className="text-destructive text-xs">
                {errors.assunto.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="corpo">Mensagem</Label>
            <Textarea
              id="corpo"
              rows={6}
              aria-invalid={!!errors.corpo}
              disabled={isSubmitting}
              {...register('corpo')}
            />
            {errors.corpo && (
              <p role="alert" className="text-destructive text-xs">
                {errors.corpo.message}
              </p>
            )}
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
