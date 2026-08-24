'use client'

import * as React from 'react'

/**
 * Diz se o CTA do hero ainda está na tela.
 *
 * ## Por que existe
 *
 * A landing tem dois "Começar grátis" em posições fixas no celular: um na
 * navbar do topo e a barra que sobe do rodapé quando a pessoa rola. Medido em
 * 24/08, os dois apareciam AO MESMO TEMPO — dois botões idênticos, mesmo
 * texto, mesma cor, na mesma tela, somando 138px (16% da viewport) de moldura
 * fixa em volta do conteúdo.
 *
 * Não é só redundância visual: dois CTAs iguais competindo dividem a atenção
 * em vez de somar, e o comentário do próprio `mobile-sticky-cta` já explicava
 * que ele existe porque "o CTA da navbar perde força numa tela pequena" —
 * quer dizer, ele foi criado para SUBSTITUIR aquele, não para acompanhá-lo.
 *
 * Este hook é a fonte única dessa decisão. Os dois componentes observam o
 * mesmo elemento (`#hero-cta`) e chegam à mesma conclusão, em vez de cada um
 * medir scroll do seu jeito e discordarem na fronteira.
 *
 * Nasce `true` (hero visível) porque é o estado no topo da página, que é onde
 * todo mundo começa: começar `false` faria a barra do rodapé piscar no
 * primeiro quadro antes do observer rodar.
 */
export function useHeroCtaVisivel(): boolean {
  const [visivel, setVisivel] = React.useState(true)

  React.useEffect(() => {
    const alvo = document.getElementById('hero-cta')
    // Sem o elemento (outra página usando a navbar), o hero conta como visível
    // e nada muda de comportamento.
    if (!alvo) return

    const observer = new IntersectionObserver(([entrada]) =>
      setVisivel(entrada.isIntersecting),
    )
    observer.observe(alvo)
    return () => observer.disconnect()
  }, [])

  return visivel
}
