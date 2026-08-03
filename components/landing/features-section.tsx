import {
  BarChart3,
  KanbanSquare,
  ListChecks,
  Building2,
  Bell,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'

type Feature = {
  title: string
  description: string
  icon: LucideIcon
  accent: { text: string; bg: string; ring: string }
  delay: string
}

const features: Feature[] = [
  {
    title: 'Pipeline visual Kanban',
    description:
      'Arraste negócios entre etapas e acompanhe o funil de vendas em tempo real.',
    icon: KanbanSquare,
    accent: {
      text: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-500/10 dark:bg-blue-400/10',
      ring: 'hover:ring-blue-500/30 dark:hover:ring-blue-400/30',
    },
    delay: 'delay-0',
  },
  {
    title: 'Gestão de leads',
    description: 'Cadastre, busque e filtre leads com timeline completa de atividades.',
    icon: ListChecks,
    accent: {
      text: 'text-violet-500 dark:text-violet-400',
      bg: 'bg-violet-500/10 dark:bg-violet-400/10',
      ring: 'hover:ring-violet-500/30 dark:hover:ring-violet-400/30',
    },
    delay: 'delay-100',
  },
  {
    title: 'Dashboard de métricas',
    description:
      'Cards e gráfico de funil para acompanhar conversão e valor do pipeline.',
    icon: BarChart3,
    accent: {
      text: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
      ring: 'hover:ring-emerald-500/30 dark:hover:ring-emerald-400/30',
    },
    delay: 'delay-200',
  },
  {
    title: 'Multi-empresa',
    description: 'Gerencie vários workspaces e alterne entre eles sem perder contexto.',
    icon: Building2,
    accent: {
      text: 'text-orange-500 dark:text-orange-400',
      bg: 'bg-orange-500/10 dark:bg-orange-400/10',
      ring: 'hover:ring-orange-500/30 dark:hover:ring-orange-400/30',
    },
    delay: 'delay-0',
  },
  {
    title: 'Notificações e prazos',
    description: 'Nunca perca um prazo: veja os negócios mais próximos do vencimento.',
    icon: Bell,
    accent: {
      text: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
      ring: 'hover:ring-amber-500/30 dark:hover:ring-amber-400/30',
    },
    delay: 'delay-100',
  },
  {
    title: 'Permissões por papel',
    description:
      'Controle o que cada colaborador pode ver e fazer, com papéis Admin e Membro.',
    icon: ShieldCheck,
    accent: {
      text: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-500/10 dark:bg-red-400/10',
      ring: 'hover:ring-red-500/30 dark:hover:ring-red-400/30',
    },
    delay: 'delay-200',
  },
]

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-5xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Tudo que seu funil precisa
          </h2>
          <p className="text-muted-foreground text-lg">
            Sem planilha, sem complicação — só o essencial para vender mais.
          </p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <RevealOnScroll key={feature.title} delay={feature.delay}>
              <Card
                className={cn(
                  'h-full ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
                  feature.accent.ring,
                )}
              >
                <CardContent className="flex flex-col gap-3">
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg',
                      feature.accent.bg,
                    )}
                  >
                    <feature.icon className={cn('size-5', feature.accent.text)} />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  )
}
