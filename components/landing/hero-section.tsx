import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PipelinePreviewCard } from '@/components/landing/pipeline-preview-card'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-24 md:px-6 md:pt-28 md:pb-32">
      <div
        aria-hidden
        className="glow-radial pointer-events-none absolute top-0 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <Badge
            variant="secondary"
            className="animate-in fade-in slide-in-from-bottom-2 font-mono text-[11px] tracking-wide uppercase duration-500"
          >
            Feito para PMEs de serviço
          </Badge>
          {/* Tracking fica mais negativo quanto maior o texto — é o que separa
              um título "de template" de um desenhado. Ver também o h2 das
              demais seções, em -0.02em. */}
          <h1 className="animate-in fade-in slide-in-from-bottom-3 text-4xl font-semibold tracking-[-0.03em] text-balance duration-700 md:text-6xl">
            Simples como planilha, premium como software líder.
          </h1>
          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-4 max-w-2xl text-lg text-balance duration-700">
            Substitua a planilha em um dia. Pipeline visual, leads organizados e métricas
            em tempo real — tudo num CRM feito para agências, clínicas, consultorias e
            imobiliárias que estão começando.
          </p>
          <div className="animate-in fade-in slide-in-from-bottom-5 mt-2 flex flex-col gap-3 duration-700 sm:flex-row">
            <Link
              href="/cadastro"
              className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}
            >
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

        <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
          <PipelinePreviewCard />
        </div>
      </div>
    </section>
  )
}
