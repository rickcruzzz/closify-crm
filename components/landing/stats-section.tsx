import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { cn } from '@/lib/utils'

// NÃO coloque métrica de resultado aqui ("+47% de conversão", "1.200+ times",
// "3.2x mais leads"). Esta seção já teve exatamente esses números, copiados de
// uma landing concorrente, enquanto o produto tinha zero clientes pagantes —
// eram afirmações falsas numa página que vende assinatura.
//
// A régua é simples: só entra aqui o que dá para provar hoje. Cada item abaixo
// é um atributo verificável do produto, não uma promessa de resultado. Quando
// existir dado real de uso (e a fonte puder ser citada), aí sim vale trocar.
const stats = [
  {
    value: 'R$ 0',
    label: 'plano grátis para sempre',
    accent: 'text-emerald-500 dark:text-emerald-400',
    delay: 0,
  },
  {
    value: '2 min',
    label: 'do cadastro ao primeiro contato',
    accent: 'text-blue-500 dark:text-blue-400',
    delay: 130,
  },
  {
    value: '100%',
    label: 'dados só da sua empresa, nunca de outra',
    accent: 'text-violet-500 dark:text-violet-400',
    delay: 260,
  },
  {
    value: 'Pix',
    label: 'boleto e cartão também',
    accent: 'text-orange-500 dark:text-orange-400',
    delay: 390,
  },
]

export function StatsSection() {
  return (
    <section className="border-border/60 relative border-y px-4 py-14 md:px-6 md:py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
        {stats.map((stat) => (
          <RevealOnScroll
            key={stat.label}
            delay={stat.delay}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <span
              className={cn(
                'text-3xl font-semibold tracking-tighter md:text-4xl',
                stat.accent,
              )}
            >
              {stat.value}
            </span>
            <span className="text-muted-foreground max-w-[16ch] font-mono text-sm leading-relaxed tracking-wide uppercase">
              {stat.label}
            </span>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  )
}
