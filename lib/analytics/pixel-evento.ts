/**
 * Eventos disparados pelo NAVEGADOR, e a decisão de disparar.
 *
 * ## Por que existe uma decisão, e não só uma chamada
 *
 * `fbq` não é uma função que sempre está lá. O pixel deste projeto se recusa a
 * carregar por quatro razões diferentes (`components/analytics/meta-pixel.tsx`):
 * a pessoa não aceitou os cookies, não é o domínio de produção, é uma rota da
 * área logada, ou o ID veio inválido. Em qualquer um dos quatro casos, chamar
 * `fbq(...)` direto é `ReferenceError`.
 *
 * E um `ReferenceError` aqui não custa o evento — custa a VISITA. Foi
 * exatamente essa a tela preta de 24/08: uma exceção durante o commit do React
 * subiu até `app/global-error.tsx` e o site inteiro virou `#0a0a0a` para quem
 * aceitasse os cookies. A regra que ficou é a mesma daquele dia: **medição
 * quebrada custa o dado, nunca a página**.
 *
 * A decisão mora numa função pura porque gate sem teste é gate que ninguém
 * sabe se funciona — lição já paga em `lib/dono/ambiente.ts`.
 */

import { CHAVE_CONSENTIMENTO, podeRastrear } from '@/lib/analytics/consentimento'

/**
 * Os eventos que o navegador dispara. Só um, hoje.
 *
 * `ViewContent` fica no navegador e não na Conversions API porque acontece na
 * landing, onde o servidor não sabe de nada: não há sessão, não há requisição
 * própria, e o único sinal de que a pessoa chegou a olhar preço é o scroll
 * dela. É o inverso de `Lead`/`InitiateCheckout`/`AddPaymentInfo`, que só
 * podem ser servidor porque `/settings/billing` é rota privada, onde o pixel
 * está bloqueado por decisão.
 */
export type EventoDoPixel = 'ViewContent'

/** O `fbq` que o script do pixel injeta em `window`, quando injeta. */
type Fbq = (comando: 'track', evento: EventoDoPixel) => void

/**
 * Dá para disparar?
 *
 * Recebe o `fbq` em vez de ler `window` por dentro justamente para poder ser
 * testada: o caso que interessa provar é o de `fbq` AUSENTE, e o `window` de
 * teste não tem como reproduzir as quatro razões de ausência separadamente.
 *
 * `typeof` e não `!!`: o script do pixel define `window.fbq` como função, mas
 * um bloqueador de anúncio pode deixar para trás um objeto vazio ou um `true`
 * de alguma extensão. Só função é chamável.
 */
export function podeDispararNoPixel(fbq: unknown): fbq is Fbq {
  return typeof fbq === 'function'
}

/**
 * Consentimento E `fbq` presente. As duas coisas, e a primeira é a que este
 * projeto não tinha.
 *
 * Achado pelo controle negativo do roteiro de prova em 30/08: com um `fbq`
 * qualquer definido em `window`, o evento saía **mesmo sem consentimento**,
 * porque a única cerca era a ausência da função. Hoje isso não acontece em
 * produção — `meta-pixel.tsx` só injeta o script depois do aceite, então sem
 * aceite não há `fbq` nenhum —, mas a proteção era um efeito colateral de
 * outro componente, não uma regra deste caminho.
 *
 * Efeito colateral não é garantia: basta uma extensão do navegador, outro
 * script ou uma refatoração do pixel definirem `fbq` para o consentimento
 * deixar de valer, sem nada falhar. Sob LGPD isso é rastreamento sem base
 * legal, e o custo de fechar é uma comparação de string.
 */
export function podeRastrearEsteEvento(
  consentimento: string | null,
  fbq: unknown,
  // Type guard sobre o SEGUNDO parâmetro: sem isto o `fbq` continua `unknown`
  // depois da checagem e a chamada não compila.
): fbq is Fbq {
  return podeRastrear(consentimento) && podeDispararNoPixel(fbq)
}

/**
 * Dispara num `fbq` recebido, se der.
 *
 * Recebe o `fbq` em vez de ler `window` porque é o que torna esta cerca
 * testável: a suíte deste projeto roda em `environment: 'node'`, sem jsdom e
 * de propósito (`vitest.config.mts`) — *"o que quebrou de verdade neste
 * projeto foi regra, não renderização"*. Com `window` lido aqui dentro, o
 * único jeito de testar seria fabricar um `globalThis.window`, ou seja, testar
 * o fingimento em vez da regra.
 *
 * Silêncio total quando não dá. Não é falha: é o estado normal de quem recusou
 * o rastreamento, e avisar no console treinaria quem desenvolve a ignorá-lo.
 */
export function dispararComFbq(
  fbq: unknown,
  evento: EventoDoPixel,
  consentimento: string | null,
): void {
  if (!podeRastrearEsteEvento(consentimento, fbq)) return

  try {
    fbq('track', evento)
  } catch (err) {
    // O `fbq` da Meta enfileira e roda código de terceiro. Se ele lançar, o
    // erro não pode subir — pela mesma razão de toda esta cerca existir.
    console.error(`Meta Pixel: falha ao disparar ${evento}`, err)
  }
}

/**
 * O que a tela chama. Só acha o `fbq` e delega — sem regra própria, para não
 * haver caminho fora do que os testes cobrem.
 */
export function dispararEventoDoPixel(evento: EventoDoPixel): void {
  if (typeof window === 'undefined') return

  dispararComFbq(
    (window as unknown as { fbq?: unknown }).fbq,
    evento,
    window.localStorage.getItem(CHAVE_CONSENTIMENTO),
  )
}
