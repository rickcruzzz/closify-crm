import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'

export function CtaSection() {
  return (
    <section className="px-4 py-20 md:px-6 md:py-28">
      <RevealOnScroll>
        <div className="bg-card ring-foreground/10 relative mx-auto flex max-w-4xl flex-col items-center gap-6 overflow-hidden rounded-2xl p-10 text-center ring-1 md:p-16">
          <div
            aria-hidden
            className="bg-primary/10 pointer-events-none absolute -top-24 left-1/2 -z-10 h-64 w-[32rem] -translate-x-1/2 rounded-full blur-3xl"
          />
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Pronto para largar a planilha?
          </h2>
          <p className="text-muted-foreground max-w-xl text-lg">
            Crie seu workspace grátis em menos de um minuto e organize seu funil de
            vendas hoje mesmo.
          </p>
          <Link
            href="/cadastro"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'gap-2 transition-transform duration-300 hover:scale-105',
            )}
          >
            Começar grátis
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </RevealOnScroll>
    </section>
  )
}
