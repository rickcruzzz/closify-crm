'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

export function PlanCard({
  plan,
  isAdmin,
}: {
  plan: 'free' | 'pro'
  isAdmin: boolean
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Plano</CardTitle>
          <CardDescription>
            {plan === 'pro'
              ? 'Plano Pro: colaboradores e leads ilimitados.'
              : 'Plano Free: até 2 colaboradores e 50 leads.'}
          </CardDescription>
        </div>
        <Badge variant={plan === 'pro' ? 'default' : 'secondary'}>
          {plan === 'pro' ? 'Pro' : 'Free'}
        </Badge>
      </CardHeader>
      {plan === 'free' && isAdmin && (
        <CardContent>
          <Button onClick={() => setDialogOpen(true)}>Assinar Pro (R$49/mês)</Button>
        </CardContent>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assinar plano Pro</DialogTitle>
            <DialogDescription>
              A Asaas exige CPF ou CNPJ pra gerar a cobrança recorrente. Você escolhe Pix,
              boleto ou cartão na próxima tela.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
              <Input
                id="cpfCnpj"
                placeholder="Só números"
                aria-invalid={!!errors.cpfCnpj}
                disabled={isSubmitting}
                {...register('cpfCnpj')}
              />
              {errors.cpfCnpj && (
                <p className="text-destructive text-xs">{errors.cpfCnpj.message}</p>
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
    </Card>
  )
}
