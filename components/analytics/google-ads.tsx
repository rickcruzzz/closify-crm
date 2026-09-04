'use client'

import * as React from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'

import {
  EVENTO_CONSENTIMENTO,
  lerConsentimentoDoNavegador,
} from '@/components/analytics/banner-consentimento'
import { montarSendTo, registrarConversaoDeCadastro } from '@/lib/analytics/conversao-google'
import { googleAdsIdSeguro, rotuloDeConversaoSeguro } from '@/lib/analytics/google-ads-id'
import {
  DOMINIO_DE_PRODUCAO,
  ROTA_DE_CONVERSAO,
  ehAreaPrivada,
} from '@/lib/analytics/superficie-publica'

/**
 * A tag do Google Ads, com as mesmas quatro cercas do Meta Pixel.
 *
 * ## Ela existe porque a campanha de busca precisa saber o que funcionou
 *
 * Com R$ 25/dia e CPC de software no Brasil entre R$ 4 e R$ 15, a conta dá 60 a
 * 180 cliques por mês e 2 a 9 cadastros. **Nesse volume nenhum lance automático
 * do Google funciona** — o Smart Bidding pede 15 a 30 conversões mensais para
 * sair do escuro, então o lance fica em CPC manual.
 *
 * Ou seja: esta conversão não serve para o algoritmo lançar. Serve para o
 * relatório dizer **qual palavra-chave trouxe cadastro**, que é a única
 * pergunta que R$ 750/mês consegue responder. Sem ela a campanha é dinheiro no
 * escuro, o mesmo erro que a campanha `OUTCOME_TRAFFIC` da Meta cometia.
 *
 * ## A armadilha que quase engoliu isto inteiro
 *
 * `gtag.js` vem de `www.googletagmanager.com`, e a CSP deste projeto é bloqueio
 * de verdade desde 27/08. Sem o host declarado em `next.config.mjs`, o
 * navegador **recusa o script em silêncio**: campanha rodando, dinheiro saindo,
 * zero conversão no painel — erro de configuração com aparência de anúncio
 * ruim. Por isso `scripts/marketing/auditar-descoberta.mjs` confere o header na
 * resposta REAL, e não o código que o gera.
 */
export function GoogleAds() {
  const pathname = usePathname()

  // NUNCA usar `process.env.…` cru aqui: os dois valores são interpolados
  // dentro de um script INLINE e de uma URL, e uma quebra de linha colada sem
  // querer no painel da Vercel derrubou a produção inteira em 24/08 — tela
  // preta para quem aceitasse os cookies. Ver `lib/analytics/google-ads-id.ts`.
  const id = googleAdsIdSeguro(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID)
  const rotulo = rotuloDeConversaoSeguro(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL)
  const sendTo = montarSendTo(id, rotulo)

  // A exceção de `/bem-vindo`, e só ela: a conversão do Google nasce no
  // navegador, então a página onde ela acontece precisa ser alcançável.
  const eAreaPrivada = ehAreaPrivada(pathname, { permitirConversao: true })
  const eRotaDeConversao = pathname === ROTA_DE_CONVERSAO

  // `undefined` no servidor: durante a renderização inicial não há `window`, e
  // deixar passar faria o script entrar no HTML antes de qualquer checagem.
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
    // `storage` cobre a aba vizinha: aceitar em uma e a tag ligar na outra.
    window.addEventListener('storage', reavaliar)
    return () => {
      window.removeEventListener(EVENTO_CONSENTIMENTO, reavaliar)
      window.removeEventListener('storage', reavaliar)
    }
  }, [])

  const ligada = Boolean(sendTo) && !eAreaPrivada && eProducao && consentido

  /**
   * O disparo pela NAVEGAÇÃO interna.
   *
   * Cobre quem confirma o e-mail: `confirmar/page.tsx:82` faz
   * `router.replace('/bem-vindo')`, troca de rota sem recarregar a página, e
   * nesse caminho o `<Script>` já rodou há muito — nenhum callback dele volta a
   * disparar.
   *
   * A dedupe mora em `registrarConversaoDeCadastro`, não aqui: este efeito e o
   * `onReady` abaixo cobrem casos diferentes e podem coincidir, e é a marca em
   * `localStorage` que garante uma conversão por conta.
   */
  React.useEffect(() => {
    if (!ligada || !eRotaDeConversao) return
    registrarConversaoDeCadastro(sendTo)
  }, [ligada, eRotaDeConversao, sendTo])

  if (!ligada) return null

  return (
    <>
      <Script
        id="google-ads-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
      />
      <Script
        id="google-ads-init"
        strategy="afterInteractive"
        /**
         * O disparo pelo CARREGAMENTO da página.
         *
         * Cobre a entrada pelo Google: `app/auth/callback/route.ts:55` responde
         * com um redirect HTTP para `/bem-vindo`, então a rota nasce já sendo a
         * de conversão. O efeito acima corre nesse caso ANTES de este script
         * executar — `window.gtag` ainda não existe, a chamada é recusada em
         * silêncio, e sem este segundo caminho a conversão se perderia.
         *
         * São os dois porque são dois caminhos de entrada reais, e perder o do
         * Google seria perder justamente o cadastro de menor atrito.
         */
        onReady={() => {
          if (eRotaDeConversao) registrarConversaoDeCadastro(sendTo)
        }}
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  )
}
