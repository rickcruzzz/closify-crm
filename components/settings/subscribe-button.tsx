'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, Zap } from 'lucide-react'

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
import { createCheckout } from '@/lib/asaas/actions'
import { checkoutSchema, type CheckoutValues } from '@/lib/validations/billing'
import { PRO_PLAN_PRICE } from '@/lib/plans'
import { formatarCpfCnpj } from '@/lib/documento-br'

export function SubscribeButton() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { cpfCnpj: '' },
  })

  async function onSubmit(values: CheckoutValues) {
    setIsSubmitting(true)
    const result = await createCheckout(values)
    if (result?.error) {
      toast.error(result.error)
      setIsSubmitting(false)
    }
    // Sem erro: createCheckout já fez redirect() pro link de pagamento do
    // Asaas, não sobra nada pra fazer aqui.
  }

  return (
    <>
      <Button onClick={() => setDialogOpen(true)} className="w-fit">
        <Zap className="size-4" />
        Assinar Pro por R$ {PRO_PLAN_PRICE}/mês
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assinar plano Pro</DialogTitle>
            <DialogDescription>
              A Asaas exige CPF ou CNPJ pra gerar a cobrança recorrente. Você escolhe Pix,
              boleto ou cartão na próxima tela.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
              {/* Formata durante a digitação e alterna sozinho para CNPJ ao
                  passar de 11 dígitos. O dígito verificador é conferido no
                  schema, antes de chamar o Asaas: sem isso um número errado só
                  falhava lá, com mensagem genérica que não dizia o que
                  corrigir. */}
              <Controller
                name="cpfCnpj"
                control={control}
                render={({ field }) => (
                  <Input
                    id="cpfCnpj"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    aria-invalid={!!errors.cpfCnpj}
                    disabled={isSubmitting}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(formatarCpfCnpj(e.target.value))}
                  />
                )}
              />
              {errors.cpfCnpj && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.cpfCnpj.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Continuar para pagamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
