'use client'

import * as React from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'

import {
  EVENTO_CONSENTIMENTO,
  lerConsentimentoDoNavegador,
} from '@/components/analytics/banner-consentimento'
import { pixelIdSeguro } from '@/lib/analytics/pixel-id'
import { DOMINIO_DE_PRODUCAO, ehAreaPrivada } from '@/lib/analytics/superficie-publica'

/**
 * Meta Pixel, só nas páginas públicas.
 *
 * A lista de rotas privadas e o domínio de produção saíram deste arquivo para
 * `lib/analytics/superficie-publica.ts` quando o Google Ads entrou: dois
 * rastreadores com duas cópias da mesma regra divergem, e o porquê inteiro —
 * inclusive o caso de `/hoje` e `/calendario`, que faltavam na lista e só
 * apareceram em 21/08 pelo erro #418/#423 que produziam — está lá.
 *
 * **O pixel NÃO recebe a exceção de `/bem-vindo`** que o Google Ads recebe, e
 * isso é decisão: as conversões da Meta nascem no servidor (Conversions API),
 * então ele não perde nada ficando fora da área logada inteira.
 *
 * Conformidade (fechado em 23/08): este pixel grava cookie de terceiro
 * (`_fbp`) e é rastreamento de marketing sob a LGPD — a mesma razão pela qual
 * o GA4 foi descartado deste projeto. Ele agora só existe DEPOIS de a pessoa
 * aceitar, em `BannerConsentimento`. Bloqueio prévio, não desligamento
 * posterior: enquanto não houver "aceito", o script não entra na página, e
 * portanto nenhum cookie é gravado. Consentimento pedido depois do
 * rastreamento não é consentimento.
 */
export function MetaPixel() {
  const pathname = usePathname()
  // NUNCA usar `process.env.NEXT_PUBLIC_META_PIXEL_ID` cru aqui: o valor é
  // interpolado dentro de um script INLINE, e uma quebra de linha colada sem
  // querer no painel da Vercel derrubou a produção inteira em 24/08 — tela
  // preta para quem aceitasse os cookies. Ver `lib/analytics/pixel-id.ts`.
  const pixelId = pixelIdSeguro(process.env.NEXT_PUBLIC_META_PIXEL_ID)

  const eAreaPrivada = ehAreaPrivada(pathname)

  // `undefined` no servidor: durante a renderização inicial não há `window`, e
  // deixar passar aqui faria o script entrar no HTML e disparar antes de
  // qualquer checagem. Como o pixel só tem valor depois da hidratação
  // (`afterInteractive`), não renderizar no servidor não custa evento nenhum.
  const hostname = typeof window === 'undefined' ? undefined : window.location.hostname
  const eProducao = hostname === DOMINIO_DE_PRODUCAO

  // Nasce `false` e nunca `true` no servidor: sem `window` não há como saber a
  // escolha, e o padrão seguro é não rastrear. Vira `true` no efeito, e volta a
  // valer imediatamente quando alguém aceita nesta mesma visita — que é
  // exatamente a visita vinda do anúncio, a que mais importa medir.
  const [consentido, setConsentido] = React.useState(false)

  React.useEffect(() => {
    const reavaliar = () => setConsentido(lerConsentimentoDoNavegador() === 'aceito')
    reavaliar()
    window.addEventListener(EVENTO_CONSENTIMENTO, reavaliar)
    // `storage` cobre a aba vizinha: aceitar em uma e o pixel ligar na outra.
    window.addEventListener('storage', reavaliar)
    return () => {
      window.removeEventListener(EVENTO_CONSENTIMENTO, reavaliar)
      window.removeEventListener('storage', reavaliar)
    }
  }, [])

  if (!pixelId || eAreaPrivada || !eProducao || !consentido) return null

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel de rastreamento, não imagem de conteúdo */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}
