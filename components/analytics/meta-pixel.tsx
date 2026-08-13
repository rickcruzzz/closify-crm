'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

/**
 * Meta Pixel — só nas páginas públicas.
 *
 * O CRM logado (`/dashboard`, `/kanban`, `/leads`, `/settings`, `/perfil`,
 * `/onboarding`, `/bem-vindo`) nunca carrega isto: quem já é cliente não é
 * alvo de atribuição de anúncio, e reduzir o pixel às páginas que uma visita
 * paga de fato alcança (landing, cadastro, login, termos, privacidade) é o
 * que mantém a superfície de rastreamento do tamanho do que se justifica.
 *
 * Nota de conformidade: este pixel grava cookie de terceiro (`_fbp`) e é
 * rastreamento de verdade sob a LGPD — a mesma razão pela qual o GA4 foi
 * descartado do projeto (ver docs/estado-atual.md, decisão travada). Hoje
 * não existe banner de consentimento de cookies no site. Ligado por pedido
 * explícito; registrado aqui e em docs/estado-atual.md como risco de
 * compliance em aberto, não como decisão silenciosa.
 */
const PREFIXOS_PRIVADOS = [
  '/dashboard',
  '/kanban',
  '/leads',
  '/settings',
  '/perfil',
  '/onboarding',
  '/bem-vindo',
]

export function MetaPixel() {
  const pathname = usePathname()
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID

  const eAreaPrivada = PREFIXOS_PRIVADOS.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  )

  if (!pixelId || eAreaPrivada) return null

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
