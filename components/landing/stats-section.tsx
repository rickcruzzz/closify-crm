import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { cn } from '@/lib/utils'

const stats = [
  {
    value: '+47%',
    label: 'taxa de conversão',
    accent: 'text-blue-500 dark:text-blue-400',
    delay: 'delay-0',
  },
  {
    value: '3.2x',
    label: 'leads qualificados',
    accent: 'text-violet-500 dark:text-violet-400',
    delay: 'delay-100',
  },
  {
    value: '-62%',
    label: 'ciclo de venda',
    accent: 'text-emerald-500 dark:text-emerald-400',
    delay: 'delay-200',
  },
  {
    value: '1200+',
    label: 'times usando',
    accent: 'text-orange-500 dark:text-orange-400',
    delay: 'delay-300',
  },
]

export function StatsSection() {
  return (
    <section className="border-border/50 relative border-y px-4 py-12 md:px-6">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
        {stats.map((stat) => (
          <RevealOnScroll
            key={stat.label}
            delay={stat.delay}
            className="flex flex-col items-center gap-1 text-center"
          >
            <span
              className={cn(
                'text-3xl font-semibold tracking-tight md:text-4xl',
                stat.accent,
              )}
            >
              {stat.value}
            </span>
            <span className="text-muted-foreground text-sm">{stat.label}</span>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  )
}
