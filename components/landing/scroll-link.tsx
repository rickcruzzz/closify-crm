'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Tempo de espera entre o clique e o início da rolagem — dá espaço pro
 * `scale-95` ser percebido antes da tela se mover. Curto o bastante pra não
 * parecer travado, longo o bastante pra registrar como intencional.
 */
const DELAY_MS = 150

type Props = React.ComponentPropsWithoutRef<'a'> & { href: `#${string}` }

/**
 * Link de âncora pra mesma página, com feedback de clique antes de rolar.
 *
 * Sem isto, `href="#secao"` pula instantâneo — sem `scroll-behavior: smooth`
 * em lugar nenhum do CSS e sem nenhum sinal de que o clique foi recebido,
 * numa página que se vende como acabamento premium.
 *
 * O `scale-95` é ligado por estado, não por `:active` do navegador: `:active`
 * dura só o tempo físico do botão pressionado, que costuma ser mais curto que
 * o delay e cortaria a animação pela metade antes da rolagem começar.
 *
 * Aceita e compõe um `onClick` externo de propósito — necessário pro menu
 * mobile, onde o alvo real é a prop `render` de um `SheetClose` (base-ui),
 * que injeta o próprio `onClick` (fechar o menu) no elemento passado.
 */
export function ScrollLink({ href, className, onClick, children, ...props }: Props) {
  const [pressionado, setPressionado] = React.useState(false)

  function aoClicar(evento: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(evento)
    if (evento.defaultPrevented) return
    if (evento.button !== 0) return
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return

    evento.preventDefault()
    setPressionado(true)

    window.setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.pushState(null, '', href)
      setPressionado(false)
    }, DELAY_MS)
  }

  return (
    <a
      href={href}
      onClick={aoClicar}
      className={cn(
        'transition-all duration-150 ease-out',
        pressionado && 'scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  )
}
