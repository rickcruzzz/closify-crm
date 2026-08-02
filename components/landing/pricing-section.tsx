import Link from 'next/link'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'

type Plan = {
  name: string
  price: string
  period?: string
  description: string
  features: string[]
  cta: string
  href: string
  highlighted?: boolean
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: 'R$0',
    description: 'Para começar a organizar seu funil sem custo.',
    features: [
      'Até 2 colaboradores',
      'Até 50 leads',
      'Pipeline Kanban',
      'Dashboard de métricas',
    ],
    cta: 'Começar grátis',
    href: '/cadastro',
  },
  {
    name: 'Pro',
    price: 'R$49',
    period: '/mês',
    description: 'Para times que já venderam a planilha e querem escalar.',
    features: [
      'Colaboradores ilimitados',
      'Leads ilimitados',
      'Pipeline Kanban',
      'Dashboard de métricas',
      'Suporte prioritário',
    ],
    cta: 'Assinar Pro',
    href: '/cadastro',
    highlighted: true,
  },
]

export function PricingSection() {
  return (
    <section id="planos" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Planos para cada fase do seu negócio
          </h2>
          <p className="text-muted-foreground text-lg">
            Comece grátis e faça upgrade quando o funil crescer.
          </p>
        </div>

        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(plan.highlighted && 'ring-primary ring-2')}
            >
              <CardHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{plan.name}</span>
                  {plan.highlighted && <Badge>Popular</Badge>}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="size-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={cn(
                    buttonVariants({ variant: plan.highlighted ? 'default' : 'outline' }),
                    'w-full',
                  )}
                >
                  {plan.cta}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
