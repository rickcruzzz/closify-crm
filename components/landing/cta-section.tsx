import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CtaSection() {
  return (
    <section className="px-4 py-20 md:px-6 md:py-28">
      <div className="bg-card ring-foreground/10 mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-2xl p-10 text-center ring-1 md:p-16">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Pronto para largar a planilha?
        </h2>
        <p className="text-muted-foreground max-w-xl text-lg">
          Crie seu workspace grátis em menos de um minuto e organize seu funil de vendas
          hoje mesmo.
        </p>
        <Link href="/cadastro" className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
          Começar grátis
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  )
}
