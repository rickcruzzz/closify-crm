'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

/**
 * Meta Pixel, só nas páginas públicas.
 *
 * O CRM logado (`/dashboard`, `/kanban`, `/leads`, `/settings`, `/perfil`,
 * `/onboarding`, `/bem-vindo`, `/hoje`, `/calendario`) nunca carrega isto:
 * quem já é cliente não é alvo de atribuição de anúncio, e reduzir o pixel às
 * páginas que uma visita paga de fato alcança (landing, cadastro, login,
 * termos, privacidade) é o que mantém a superfície de rastreamento do tamanho
 * do que se justifica.
 *
 * `/hoje` e `/calendario` faltavam nesta lista (achado em 21/08 investigando
 * lentidão percebida): o pixel carregava nelas de verdade, `<Script
 * strategy="afterInteractive">` competindo com o React durante hidratação —
 * medido com erro #418/#423 do React só nessas duas rotas, ausente nas outras
 * do CRM. A página inteira era descartada e re-renderizada do zero no
 * navegador, o que soma tempo real de carregamento em cima do que já é lento.
 * Mesma classe de lacuna que o `middleware.ts` já pagou (rotas existem, na
 * sidebar, mas ficaram fora de uma lista de exclusão).
 *
 * Nota de conformidade: este pixel grava cookie de terceiro (`_fbp`) e é
 * rastreamento de verdade sob a LGPD, a mesma razão pela qual o GA4 foi
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
  '/hoje',
  '/calendario',
]

/**
 * O domínio de produção. Só ele alimenta o pixel.
 *
 * Medido em 20/08/2026, olhando os eventos que a Meta de fato recebeu: além de
 * `www.velofunil.com.br`, chegavam eventos de `localhost` e de previews
 * `closify-crm-dr3t-*.vercel.app`. Num único dia (13/08), **18.192 PageViews
 * vieram de `localhost`** — provavelmente recarregamento em laço durante o
 * desenvolvimento.
 *
 * Isso não é ruído inofensivo: o pixel é o conjunto de dados com que a Meta
 * aprende quem é o público a perseguir. Milhares de visitas falsas de uma
 * máquina só ensinam o algoritmo a procurar gente que não existe, e a conta
 * disso chega em dinheiro de anúncio gasto no alvo errado.
 *
 * A checagem é por `hostname` do navegador porque é o que separa os três casos
 * de verdade. `NODE_ENV` não serve: preview da Vercel roda como `production`.
 */
const DOMINIO_DE_PRODUCAO = 'www.velofunil.com.br'

export function MetaPixel() {
  const pathname = usePathname()
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID

  const eAreaPrivada = PREFIXOS_PRIVADOS.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  )

  // `undefined` no servidor: durante a renderização inicial não há `window`, e
  // deixar passar aqui faria o script entrar no HTML e disparar antes de
  // qualquer checagem. Como o pixel só tem valor depois da hidratação
  // (`afterInteractive`), não renderizar no servidor não custa evento nenhum.
  const hostname = typeof window === 'undefined' ? undefined : window.location.hostname
  const eProducao = hostname === DOMINIO_DE_PRODUCAO

  if (!pixelId || eAreaPrivada || !eProducao) return null

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
