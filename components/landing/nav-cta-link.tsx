'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useDestinoComOrigem } from '@/components/landing/usar-destino-com-origem'
import { cn } from '@/lib/utils'

/** Mesmo valor do ScrollLink, consistência de toque na navbar inteira. */
const DELAY_MS = 150

type Props = React.ComponentPropsWithoutRef<typeof Link>

/**
 * Link de navegação real (não âncora) com o mesmo feedback de clique do
 * ScrollLink, pra "Entrar"/"Começar grátis" não destoarem dos links de
 * seção ao lado, na mesma navbar.
 *
 * Usa `next/link` por baixo (não `<a>` cru) pra manter o prefetch
 * automático; a navegação em si é programática via `router.push`, depois
 * do delay, pra dar tempo do `scale-95` ser percebido antes da troca de
 * página cortar tudo.
 *
 * `forwardRef`: usado dentro de `SheetClose` (Base UI) no menu mobile, que
 * injeta um `ref` no elemento passado via `render` pra gerenciar foco ao
 * fechar o diálogo, sem encaminhar pro `Link`, o React avisa "Function
 * components cannot be given refs" e o foco não volta pra onde devia.
 */
export const NavCtaLink = React.forwardRef<HTMLAnchorElement, Props>(function NavCtaLink(
  { href, className, onClick, children, ...props },
  ref,
) {
  const router = useRouter()
  const [pressionado, setPressionado] = React.useState(false)

  /**
   * Este botão é o SEGUNDO caminho para `/cadastro` em toda página pública, e
   * sem isto ele perdia a origem enquanto o CTA do corpo a mantinha.
   *
   * Medido no navegador em 04/09: `/quanto-custa-um-crm` tem dois botões
   * "Começar grátis" idênticos, e qual promessa a pessoa via em `/cadastro`
   * dependia de qual dos dois ela clicasse. Ver `useDestinoComOrigem`.
   */
  const destino = useDestinoComOrigem(href.toString())

  function aoClicar(evento: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(evento)
    if (evento.defaultPrevented) return
    if (evento.button !== 0) return
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return

    evento.preventDefault()
    setPressionado(true)

    window.setTimeout(() => {
      // `destino`, não `href`: a navegação aqui é programática, e usar o `href`
      // cru faria o link MOSTRAR a origem na barra de status e navegar sem ela.
      // Discordância invisível — o caso mais difícil de achar depois.
      router.push(destino)
    }, DELAY_MS)
    // Sem reset de `pressionado`: a navegação troca a página, o componente
    // desmonta sozinho, resetar aqui não teria efeito útil.
  }

  return (
    <Link
      ref={ref}
      href={destino}
      onClick={aoClicar}
      className={cn(
        'transition-all duration-150 ease-out',
        pressionado && 'scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  )
})
