'use client'

import * as React from 'react'

import { dispararEventoDoPixel, type EventoDoPixel } from '@/lib/analytics/pixel-evento'

/**
 * Dispara um evento do Pixel quando o bloco entra na tela, uma vez só.
 *
 * ## Por que "entrar na tela" e não "clicar"
 *
 * A seção de planos é onde a decisão de preço acontece, e a maior parte de
 * quem decide não clica em nada — sai, pensa, e volta depois. Esperar o clique
 * mediria só a ponta, e é justamente volume que falta a este funil.
 *
 * ## Por que não observar `RevealOnScroll`, que já observa scroll
 *
 * Ele existe para animar, e por isso desiste do observer em dois casos que
 * aqui seriam erros: quando o bloco já está no viewport ao montar, e quando o
 * aparelho pede `prefers-reduced-motion`. Nos dois, a pessoa VÊ a seção e não
 * haveria evento. Reaproveitá-lo trocaria uma cerca de animação por uma
 * medição com buraco silencioso.
 */
export function EventoAoVer({
  evento,
  children,
}: {
  evento: EventoDoPixel
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  // `ref` e não `useState`: disparar não muda nada na tela, e estado aqui
  // causaria um render a mais em cada visita à seção, sem nada para mostrar.
  const jaDisparou = React.useRef(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el || jaDisparou.current) return

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting || jaDisparou.current) return
        jaDisparou.current = true
        dispararEventoDoPixel(evento)
        // Uma vez por carregamento de página. Sem isto, rolar para cima e para
        // baixo na mesma visita contaria como várias — e o número que a Meta
        // usa para aprender passaria a medir inquietação, não interesse.
        observer.disconnect()
      },
      // Metade da seção visível, não um pixel: encostar a borda ao rolar
      // rápido em direção ao rodapé não é ter olhado o preço.
      { threshold: 0.5 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [evento])

  // Um `<div>` comum, e isso é decisão, não descuido.
  //
  // A primeira versão usava `display: contents` para o wrapper não existir no
  // layout — e ela nunca teria funcionado: elemento com `contents` **não gera
  // caixa**, e o IntersectionObserver não tem o que medir num elemento sem
  // caixa. O evento simplesmente nunca dispararia, sem erro nenhum no console,
  // que é a pior forma de uma medição falhar.
  //
  // O div é inócuo aqui porque as seções da landing são empilhadas em fluxo de
  // bloco dentro de `<main>` (`app/page.tsx`), então uma caixa a mais em volta
  // de uma `<section>` não muda nada. **Não envolva com isto um filho de grid
  // ou de flex** — ali o wrapper viraria o item, e o filho perderia o
  // posicionamento.
  return <div ref={ref}>{children}</div>
}
