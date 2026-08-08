import Link from 'next/link'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'

type Plan = {
  name: string
  price: string
  period?: string
  description: string
  features: string[]
  cta: string
  href: string
  highlighted?: boolean
  delay: number
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
    delay: 0,
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
    delay: 120,
  },
]

export function PricingSection() {
  return (
    // `overflow-x-clip` segura o brilho decorativo abaixo, que é mais largo
    // que a viewport no mobile e gerava scroll horizontal na página inteira.
    <section id="planos" className="relative overflow-x-clip px-4 py-20 md:px-6 md:py-28">
      <div
        aria-hidden
        className="glow-radial pointer-events-none absolute top-1/3 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2"
      />
      <div className="mx-auto max-w-4xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            Planos
          </span>
          <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Planos para cada fase do seu negócio
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            Comece grátis e faça upgrade quando o funil crescer.
          </p>
        </RevealOnScroll>

        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <RevealOnScroll key={plan.name} delay={plan.delay}>
              <Card
                className={cn(
                  'h-full transition-[transform,box-shadow] duration-300',
                  'pointer:hover:-translate-y-1 pointer:hover:shadow-lg',
                  plan.highlighted
                    ? 'ring-primary shadow-primary/10 shadow-lg ring-2'
                    : 'ring-border ring-1',
                )}
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
                        <Check
                          aria-hidden
                          className="size-4 shrink-0 text-emerald-500 dark:text-emerald-400"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={cn(
                      buttonVariants({
                        variant: plan.highlighted ? 'default' : 'outline',
                      }),
                      'w-full',
                    )}
                  >
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  )
}
