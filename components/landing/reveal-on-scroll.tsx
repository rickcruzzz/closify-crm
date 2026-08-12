'use client'

import * as React from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Revela o conteúdo quando ele entra no viewport.
 *
 * A versão anterior era Server Component e só aplicava `animate-in` do
 * tw-animate-css: apesar do nome, não observava scroll nenhum. As ~20
 * instâncias da landing animavam todas ao mesmo tempo no primeiro paint,
 * inclusive as muito abaixo da dobra — era o pico de travamento no load.
 *
 * Três garantias aqui:
 *
 * 1. Começa visível e sem `style` até hidratar. Se o JS falhar ou demorar, o
 *    conteúdo aparece normalmente. A versão anterior usava `fill-mode-both`,
 *    que deixava tudo com `opacity: 0` até a animação rodar — sem JS, página
 *    em branco.
 * 2. O que já está no viewport no mount não anima, então não há flash de
 *    conteúdo acima da dobra.
 * 3. `disconnect()` assim que revela: anima uma vez, sem custo residual.
 */
/**
 * Duração e curva da entrada.
 *
 * 750ms com `easeOutQuad`. As duas coisas juntas é que dão o resultado —
 * mexer só na duração não adianta.
 *
 * A curva anterior, `cubic-bezier(0.16, 1, 0.3, 1)`, punha METADE do movimento
 * nos primeiros 15% do tempo: o elemento chegava quase no lugar num piscar e
 * gastava o resto dos 550ms percorrendo os últimos pixels, que ninguém
 * enxerga. Por isso parecia rápida mesmo sendo longa.
 *
 * `cubic-bezier(0.25, 0.46, 0.45, 0.94)` distribui: aos 20% do tempo, 25% do
 * caminho. O movimento é visível do começo ao fim, e a chegada é macia em vez
 * de brusca.
 */
const DURACAO = 750
/** Definida em `globals.css` e compartilhada com o hero — ver `--ease-entrada`. */
const CURVA = 'var(--ease-entrada)'

/**
 * Quanto o elemento sobe.
 *
 * Passou de 16px para 24px junto com a duração. Distância curta em animação
 * lenta é o pior dos dois mundos: demora e não parece que algo aconteceu.
 */
const DISTANCIA = 24

export function RevealOnScroll({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  /** Atraso do stagger em milissegundos. */
  delay?: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(true)
  const [hydrated, setHydrated] = React.useState(false)
  // `will-change` avisa o navegador para promover o elemento a camada própria
  // ANTES de a animação começar — é o que evita o engasgo do primeiro quadro,
  // quando ele descobre que precisa promover no meio do movimento.
  //
  // Só enquanto o elemento espera e enquanto anda. Camada custa memória de
  // GPU, e a landing tem ~20 destes: deixá-las promovidas para sempre trocaria
  // um engasgo por consumo permanente.
  const [animando, setAnimando] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    // `matchMedia` em vez de confiar só no CSS: sem isso o elemento ainda
    // ficaria com opacity 0 esperando o observer, mesmo com animação desligada.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHydrated(true)
      return
    }

    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight - 32 && rect.bottom > 0) {
      setHydrated(true)
      return
    }

    setVisible(false)
    setHydrated(true)
    setAnimando(true)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(className)}
      // Assim que a transição termina, a camada de GPU é devolvida. Dispara
      // uma vez por propriedade (opacidade e transform), e `setAnimando(false)`
      // repetido não custa nada — o React ignora estado igual.
      onTransitionEnd={() => setAnimando(false)}
      style={
        hydrated
          ? {
              opacity: visible ? 1 : 0,
              // `translate3d` e não `translateY`: a forma com três eixos é a
              // que garante o caminho da GPU em todos os navegadores. A de um
              // eixo costuma ser promovida também, mas "costuma" não é
              // garantia — e é justamente no celular mais fraco, onde a
              // diferença aparece, que ela falha.
              transform: visible ? 'translate3d(0,0,0)' : `translate3d(0,${DISTANCIA}px,0)`,
              transition: `opacity ${DURACAO}ms ${CURVA} ${delay}ms, transform ${DURACAO}ms ${CURVA} ${delay}ms`,
              // Só opacidade e transform são animadas, e as duas o
              // compositor resolve sozinho, sem recalcular layout nem
              // repintar. É o que sustenta 60fps aqui — não a duração.
              willChange: animando ? 'opacity, transform' : undefined,
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
