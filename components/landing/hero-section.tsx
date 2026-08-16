import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PipelinePreviewCard } from '@/components/landing/pipeline-preview-card'
import { SegmentBadge } from '@/components/landing/segment-badge'
import { ScrollLink } from '@/components/landing/scroll-link'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-24 md:px-6 md:pt-28 md:pb-32">
      <div
        aria-hidden
        className="glow-radial pointer-events-none absolute top-0 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <SegmentBadge className="animate-in fade-in slide-in-from-bottom-2 ease-entrada font-mono text-xs tracking-wide uppercase duration-[650ms]" />
          {/* Tracking fica mais negativo quanto maior o texto — é o que separa
              um título "de template" de um desenhado. Ver também o h2 das
              demais seções, em -0.02em. */}
          <h1 className="animate-in fade-in slide-in-from-bottom-3 ease-entrada text-4xl font-semibold tracking-[-0.03em] text-balance duration-[750ms] md:text-6xl">
            Pare de perder venda por esquecimento.
          </h1>
          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-4 ease-entrada max-w-2xl text-lg text-balance duration-[800ms]">
            Todo cliente que você esquece de responder é um cliente que você perde. O
            Velo Funil mostra, numa tela só, com quem você precisa falar hoje — sem
            post-it, sem aba de planilha escondida, sem depender da sua memória.
          </p>
          {/* `items-stretch` é o padrão do flex — e é por ser padrão que
              ninguém percebe quando some. É ele que dá aos dois botões a mesma
              largura no celular: o container encolhe até o filho mais largo, e
              os dois esticam nele.

              Basta alguém acrescentar `items-center` aqui um dia, para
              centralizar um ícone qualquer, e as larguras se separam sem que a
              mudança pareça ter relação. Escrito, é decisão; implícito, é
              acidente esperando. Acima de `sm` os botões vão lado a lado e o
              alinhamento passa a ser vertical. */}
          <div className="animate-in fade-in slide-in-from-bottom-5 ease-entrada mt-2 flex flex-col items-stretch gap-3 duration-[850ms] sm:flex-row sm:items-center">
            <Link
              id="hero-cta"
              href="/cadastro"
              className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 gap-2')}
            >
              Começar grátis
              <ArrowRight className="size-4" />
            </Link>
            <ScrollLink
              href="#como-funciona"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'min-h-11 active:translate-y-0',
              )}
            >
              Ver como funciona
            </ScrollLink>
          </div>
          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-5 ease-entrada text-sm duration-[850ms]">
            A partir de R$0, sem cartão. Pro por R$49/mês, da empresa inteira.
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-5 ease-entrada duration-[900ms]">
          <PipelinePreviewCard />
        </div>
      </div>
    </section>
  )
}
