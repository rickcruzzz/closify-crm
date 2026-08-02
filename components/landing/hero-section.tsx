import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-24 md:px-6 md:pt-28 md:pb-32">
      <div
        aria-hidden
        className="bg-primary/10 pointer-events-none absolute top-0 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2 rounded-full blur-3xl"
      />
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
        <Badge
          variant="secondary"
          className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          Feito para PMEs de serviço
        </Badge>
        <h1 className="animate-in fade-in slide-in-from-bottom-3 text-4xl font-semibold tracking-tight text-balance duration-700 md:text-6xl">
          Simples como planilha, premium como software líder.
        </h1>
        <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-4 max-w-2xl text-lg text-balance duration-700">
          Substitua a planilha em um dia. Pipeline visual, leads organizados e métricas em
          tempo real — tudo num CRM feito para agências, clínicas, consultorias e
          imobiliárias que estão começando.
        </p>
        <div className="animate-in fade-in slide-in-from-bottom-5 mt-2 flex flex-col gap-3 duration-700 sm:flex-row">
          <Link href="/cadastro" className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
            Começar grátis
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="#funcionalidades"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
          >
            Ver funcionalidades
          </Link>
        </div>
      </div>
    </section>
  )
}
