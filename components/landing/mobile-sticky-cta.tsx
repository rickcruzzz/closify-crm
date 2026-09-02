'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { useHeroCtaVisivel } from '@/hooks/use-hero-cta-visivel'
import {
  EVENTO_CONSENTIMENTO,
  lerConsentimentoDoNavegador,
} from '@/components/analytics/banner-consentimento'
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
  // A visibilidade do hero vem do hook compartilhado, e não de um observer
  // próprio: a navbar precisa da MESMA resposta para esconder o CTA dela
  // quando esta barra sobe, e dois observers independentes discordariam na
  // fronteira — o instante em que os dois botões apareceriam juntos.
  const heroVisivel = useHeroCtaVisivel()
  const [finalVisivel, setFinalVisivel] = React.useState(false)
  // Nasce `false` porque o servidor não sabe: o padrão é o comportamento
  // normal, e quem tem o banner aberto vê a barra subir logo depois.
  const [bannerAberto, setBannerAberto] = React.useState(false)

  React.useEffect(() => {
    const finalCta = document.getElementById('final-cta')
    if (!finalCta) return

    const finalObserver = new IntersectionObserver(([entry]) =>
      setFinalVisivel(entry.isIntersecting),
    )
    finalObserver.observe(finalCta)
    return () => finalObserver.disconnect()
  }, [])

  React.useEffect(() => {
    const sincronizar = () => setBannerAberto(lerConsentimentoDoNavegador() === null)
    sincronizar()
    window.addEventListener(EVENTO_CONSENTIMENTO, sincronizar)
    return () => window.removeEventListener(EVENTO_CONSENTIMENTO, sincronizar)
  }, [])

  // ## Por que o banner aberto FORÇA esta barra a aparecer
  //
  // Na primeira dobra do telefone o CTA do hero fica atrás do banner —
  // medido em 02/09, em 390×659: botão em 532..580, banner em 534..659, e
  // `elementFromPoint` no centro do botão devolvendo o texto do banner.
  // Rolar 130px libera, mas até lá a dobra que o anúncio pagou não tem
  // nenhum alvo clicável.
  //
  // Com o banner aberto esta barra sobe imediatamente, assentada logo acima
  // dele: o CTA do hero continua tapado e deixa de importar, porque existe um
  // botão idêntico e livre 73px acima. Assim que a pessoa responde, o banner
  // some, a variável zera e a regra volta a ser só a do hero — sem os dois
  // botões na mesma tela, que é o que esta barra existe para evitar.
  const mostrar = (!heroVisivel && !finalVisivel) || bannerAberto

  return (
    <div
      aria-hidden={!mostrar}
      // `bottom` pela variável que o banner publica, e não `bottom-0` com
      // `z-40`: a disputa de empilhamento era perdida de saída (o banner é
      // `z-50`) e o resultado, medido, era esta barra inteira debaixo dele —
      // clicável pelo teclado, invisível para o dedo.
      style={{ bottom: 'var(--altura-do-banner, 0px)' }}
      className={cn(
        'border-border/60 bg-background/95 fixed inset-x-0 z-40 border-t px-4 pt-3 backdrop-blur-md transition-transform duration-300 md:hidden',
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
