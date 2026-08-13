'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2, MessageCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  whatsappTemplateSchema,
  type WhatsAppTemplateFormInput,
  type WhatsAppTemplateFormValues,
} from '@/lib/validations/whatsapp-template'

// Gatilho e conteúdo no mesmo componente, de propósito — mesmo ajuste do
// `mobile-sidebar.tsx` (fad03be): sem `DialogTrigger` registrando o botão
// como referência do diálogo, o listener de "clicar fora fecha" do base-ui
// não reconhece o clique que ABRIU como interno, e fecha no mesmo instante
// — exige um segundo clique pra ficar aberto de vez. Antes o botão vivia no
// componente pai (`lead-detail-client.tsx`), ~200 linhas longe do
// `<Dialog>`, com `open`/`onOpenChange` controlados de fora — impossível de
// registrar como trigger de verdade estando em árvores React separadas.
export function SendWhatsAppTemplateDialog({
  onSend,
}: {
  onSend: (values: WhatsAppTemplateFormValues) => void | Promise<void>
}) {
  const [open, setOpen] = React.useState(false)
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
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <MessageCircle className="size-4" />
        Enviar modelo
      </DialogTrigger>
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
