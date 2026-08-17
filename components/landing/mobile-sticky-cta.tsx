'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Barra fixa no rodapé, só no mobile, maioria do clique de anúncio do Meta
 * chega por celular, e o CTA da navbar sticky perde força numa tela pequena
 * assim que a pessoa rola pra ler o resto da página.
 *
 * Observa dois pontos por `id` (o CTA do hero e o da seção final) em vez de
 * medir scroll manualmente: aparece quando o hero sai da viewport, some de
 * novo perto do CTA final pra não duplicar dois botões iguais na mesma tela.
 */
export function MobileStickyCta() {
  const [heroVisivel, setHeroVisivel] = React.useState(true)
  const [finalVisivel, setFinalVisivel] = React.useState(false)

  React.useEffect(() => {
    const heroCta = document.getElementById('hero-cta')
    const finalCta = document.getElementById('final-cta')
    if (!heroCta || !finalCta) return

    const heroObserver = new IntersectionObserver(([entry]) =>
      setHeroVisivel(entry.isIntersecting),
    )
    const finalObserver = new IntersectionObserver(([entry]) =>
      setFinalVisivel(entry.isIntersecting),
    )
    heroObserver.observe(heroCta)
    finalObserver.observe(finalCta)

    return () => {
      heroObserver.disconnect()
      finalObserver.disconnect()
    }
  }, [])

  const mostrar = !heroVisivel && !finalVisivel

  return (
    <div
      aria-hidden={!mostrar}
      className={cn(
        'border-border/60 bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 backdrop-blur-md transition-transform duration-300 md:hidden',
        'pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        mostrar ? 'translate-y-0' : 'pointer-events-none translate-y-full',
      )}
    >
      <Link
        href="/cadastro"
        tabIndex={mostrar ? 0 : -1}
        className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 w-full gap-2')}
      >
        Começar grátis
        <ArrowRight className="size-4" />
      </Link>
    </div>
  )
}
