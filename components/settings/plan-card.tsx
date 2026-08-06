'use client'

import * as React from 'react'
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
import { createCheckout } from '@/lib/asaas/actions'

export function PlanCard({
  plan,
  isAdmin,
}: {
  plan: 'free' | 'pro'
  isAdmin: boolean
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function handleSubscribe() {
    setIsSubmitting(true)
    const result = await createCheckout()
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
          <Button onClick={handleSubscribe} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Assinar Pro (R$49/mês)
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
