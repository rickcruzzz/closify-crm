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
      style={
        hydrated
          ? {
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
              // `ease-out` e não `ease`: entrada tem que começar rápida e
              // desacelerar. O `ease` acelera no início, e o elemento parece
              // hesitar meio quadro antes de sair do lugar — some quando você
              // procura, aparece quando você não está.
              //
              // A curva é escrita à mão em vez de `ease-out` por nome: a
              // padrão do CSS (0, 0, .58, 1) desacelera cedo demais e deixa um
              // rastro no fim dos 550ms. Esta chega perto do repouso antes e
              // some.
              transition: `opacity 550ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 550ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
