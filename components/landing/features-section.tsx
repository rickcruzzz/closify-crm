import {
  BarChart3,
  KanbanSquare,
  ListChecks,
  Building2,
  Bell,
  FileSpreadsheet,
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
  accent: { text: string; bg: string; hover: string }
  /** Stagger em milissegundos, aplicado pelo RevealOnScroll. */
  delay: number
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
      hover: 'pointer:hover:bg-blue-500/[0.04] dark:pointer:hover:bg-blue-400/[0.04]',
    },
    delay: 0,
  },
  {
    title: 'Gestão de leads',
    description: 'Cadastre, busque e filtre leads com timeline completa de atividades.',
    icon: ListChecks,
    accent: {
      text: 'text-violet-500 dark:text-violet-400',
      bg: 'bg-violet-500/10 dark:bg-violet-400/10',
      hover: 'pointer:hover:bg-violet-500/[0.04] dark:pointer:hover:bg-violet-400/[0.04]',
    },
    delay: 130,
  },
  {
    // A importação existia desde antes e não aparecia na landing — é a
    // resposta para "vou ter que digitar tudo de novo?", a objeção que mais
    // trava a troca da planilha.
    title: 'Importação de planilha',
    description:
      'Traga seus contatos de uma vez com um arquivo .csv, sem redigitar nada. Duplicados são ignorados sozinhos.',
    icon: FileSpreadsheet,
    accent: {
      text: 'text-cyan-500 dark:text-cyan-400',
      bg: 'bg-cyan-500/10 dark:bg-cyan-400/10',
      hover: 'pointer:hover:bg-cyan-500/[0.04] dark:pointer:hover:bg-cyan-400/[0.04]',
    },
    delay: 260,
  },
  {
    title: 'Dashboard de métricas',
    description:
      'Cards e gráfico de funil para acompanhar conversão e valor do pipeline.',
    icon: BarChart3,
    accent: {
      text: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
      hover:
        'pointer:hover:bg-emerald-500/[0.04] dark:pointer:hover:bg-emerald-400/[0.04]',
    },
    delay: 0,
  },
  {
    title: 'Multi-empresa',
    description: 'Gerencie vários workspaces e alterne entre eles sem perder contexto.',
    icon: Building2,
    accent: {
      text: 'text-orange-500 dark:text-orange-400',
      bg: 'bg-orange-500/10 dark:bg-orange-400/10',
      hover: 'pointer:hover:bg-orange-500/[0.04] dark:pointer:hover:bg-orange-400/[0.04]',
    },
    delay: 130,
  },
  {
    title: 'Notificações e prazos',
    description: 'Nunca perca um prazo: veja os negócios mais próximos do vencimento.',
    icon: Bell,
    accent: {
      text: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
      hover: 'pointer:hover:bg-amber-500/[0.04] dark:pointer:hover:bg-amber-400/[0.04]',
    },
    delay: 260,
  },
  {
    title: 'Permissões por papel',
    description:
      'Controle o que cada colaborador pode ver e fazer, com papéis Admin e Membro.',
    icon: ShieldCheck,
    accent: {
      text: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-500/10 dark:bg-red-400/10',
      hover: 'pointer:hover:bg-red-500/[0.04] dark:pointer:hover:bg-red-400/[0.04]',
    },
    delay: 0,
  },
]

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-5xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Funcionalidades
          </span>
          <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Tudo que seu funil precisa
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            Sem planilha, sem complicação. Só o essencial para vender mais.
          </p>
        </RevealOnScroll>

        {/* `gap-px` sobre um fundo de borda: as divisórias viram linhas de 1px
            perfeitas, sem borda dupla entre células nem canto quebrado. É o
            truque que dá o acabamento de grade contínua. */}
        <div className="bg-border ring-border grid grid-cols-1 gap-px overflow-hidden rounded-xl ring-1 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            // Sete não é múltiplo de 2 nem de 3: sobra sempre um card sozinho
            // na última linha do grid. Sem span, a célula vazia ao lado pinta
            // a cor de fundo do grid (o truque de `bg-border`+`gap-px` logo
            // acima) e vira um retângulo escuro sem nada dentro. O último
            // card ocupa a linha inteira nos dois breakpoints em vez disso —
            // resolve sem depender de quantos cards existirem no futuro.
            const ultimo = i === features.length - 1

            return (
              <RevealOnScroll key={feature.title} delay={feature.delay}>
                <Card
                  className={cn(
                    'bg-card h-full rounded-none border-0 shadow-none ring-0',
                    'transition-colors duration-200',
                    feature.accent.hover,
                    ultimo && 'sm:col-span-2 lg:col-span-3',
                  )}
                >
                  <CardContent
                    className={cn(
                      'flex flex-col gap-3',
                      ultimo && 'sm:flex-row sm:items-center sm:justify-center sm:gap-4',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-lg',
                          feature.accent.bg,
                        )}
                      >
                        <feature.icon className={cn('size-5', feature.accent.text)} />
                      </div>
                      <span className="text-muted-foreground font-mono text-xs tracking-wide">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className={cn(ultimo && 'sm:flex sm:max-w-md sm:flex-col sm:gap-1')}>
                      <h3 className="text-base font-semibold">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </RevealOnScroll>
            )
          })}
        </div>
      </div>
    </section>
  )
}
