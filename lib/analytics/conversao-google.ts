/**
 * A conversão do Google Ads: a decisão de disparar, isolada do navegador.
 *
 * ## Por que uma decisão, e não só uma chamada
 *
 * É o espelho de `lib/analytics/pixel-evento.ts`, e existe pela mesma razão:
 * `gtag` não é uma função que sempre está lá. A tag deste projeto se recusa a
 * carregar por quatro motivos (`components/analytics/google-ads.tsx`) — sem
 * consentimento, fora do domínio de produção, em rota da área logada, ou com ID
 * inválido. Em qualquer um dos quatro, chamar `gtag(...)` direto é
 * `ReferenceError`.
 *
 * E um `ReferenceError` aqui não custa a conversão — custa a VISITA. Foi
 * exatamente a tela preta de 24/08: uma exceção durante o commit do React subiu
 * até `app/global-error.tsx` e o site inteiro virou `#0a0a0a` para quem
 * aceitasse os cookies. A regra que ficou: **medição quebrada custa o dado,
 * nunca a página**.
 *
 * As funções recebem o `gtag` em vez de lerem `window` porque é isso que as
 * torna testáveis: a suíte roda em `environment: 'node'`, sem jsdom e de
 * propósito. Com `window` lido aqui dentro, o único jeito de testar o caso que
 * interessa — `gtag` AUSENTE — seria fabricar um `globalThis.window`, ou seja,
 * testar o fingimento em vez da regra.
 */

import { CHAVE_CONSENTIMENTO, podeRastrear } from '@/lib/analytics/consentimento'

/**
 * A marca de "esta conta já foi contada".
 *
 * ## O defeito que ela fecha
 *
 * A conversão dispara em `/bem-vindo`, que é o único ponto por onde os DOIS
 * caminhos de cadastro passam (e-mail confirmado e entrada pelo Google). Só
 * que `app/(dashboard)/layout.tsx:74` devolve para lá **toda vez** que alguém
 * volta com o onboarding pela metade.
 *
 * Sem esta marca, a mesma pessoa contaria várias vezes, e o custo por conversão
 * apareceria no painel do Google **menor do que é**. Número plausível com
 * conclusão errada: a classe de erro mais cara deste projeto.
 *
 * Versionada como a chave de consentimento: se um dia a definição da conversão
 * mudar, subir o número faz a contagem recomeçar em vez de herdar marcas dadas
 * para outra coisa.
 */
export const CHAVE_CONVERSAO_ENVIADA = 'vf_gads_conversao_v1'

/** A assinatura mínima do `gtag` que este projeto usa. */
type Gtag = (
  comando: 'event',
  evento: 'conversion',
  parametros: { send_to: string },
) => void

/**
 * `typeof` e não `!!`: a tag define `window.gtag` como função, mas um bloqueador
 * de anúncio pode deixar para trás um objeto vazio ou um `true` de alguma
 * extensão. Só função é chamável.
 */
export function podeDispararNoGtag(gtag: unknown): gtag is Gtag {
  return typeof gtag === 'function'
}

/**
 * As três condições, e a primeira é a que a Conversions API não tinha.
 *
 * Consentimento entra aqui mesmo com `google-ads.tsx` já só injetando o script
 * depois do aceite. A proteção lá é um efeito colateral de outro componente,
 * não uma regra deste caminho — e efeito colateral não é garantia: basta uma
 * extensão do navegador ou uma refatoração da tag definirem `gtag` para o
 * consentimento deixar de valer, sem nada falhar.
 *
 * Foi assim que o Meta Pixel passou meses com a cerca errada, achado só pelo
 * controle negativo de 30/08. Sob LGPD isso é rastreamento sem base legal, e o
 * custo de fechar é uma comparação de string.
 */
export function podeConverter(
  consentimento: string | null,
  jaEnviou: boolean,
  gtag: unknown,
  // Type guard sobre o TERCEIRO parâmetro: sem isto o `gtag` continua `unknown`
  // depois da checagem e a chamada não compila.
): gtag is Gtag {
  return podeRastrear(consentimento) && !jaEnviou && podeDispararNoGtag(gtag)
}

/**
 * Monta o `send_to`, que é o par (conta, ação) que o Google precisa.
 *
 * Devolve `null` quando falta qualquer um dos dois. Com o ID e sem o rótulo a
 * chamada sai e o Google não sabe qual conversão contar — a mais silenciosa das
 * falhas possíveis aqui, porque a tag funciona e o relatório fica zerado.
 */
export function montarSendTo(id: string | null, rotulo: string | null): string | null {
  if (!id || !rotulo) return null
  return `${id}/${rotulo}`
}

/**
 * Dispara num `gtag` recebido, se der.
 *
 * Silêncio total quando não dá. Não é falha: é o estado normal de quem recusou
 * o rastreamento ou já foi contado, e avisar no console treinaria quem
 * desenvolve a ignorá-lo.
 */
export function converterComGtag(
  gtag: unknown,
  sendTo: string | null,
  consentimento: string | null,
  jaEnviou: boolean,
): boolean {
  if (!sendTo) return false
  if (!podeConverter(consentimento, jaEnviou, gtag)) return false

  try {
    gtag('event', 'conversion', { send_to: sendTo })
    return true
  } catch (err) {
    // O `gtag` do Google enfileira e roda código de terceiro. Se ele lançar, o
    // erro não pode subir — pela mesma razão de toda esta cerca existir.
    console.error('Google Ads: falha ao disparar a conversão', err)
    return false
  }
}

/**
 * O que a tela chama. Só acha o `gtag`, lê as duas marcas e delega — sem regra
 * própria, para não haver caminho fora do que os testes cobrem.
 *
 * A marca de "já enviou" só é gravada **depois** de a chamada ter acontecido:
 * gravar antes perderia a conversão de quem fechasse a aba no meio, e o erro
 * seria para o lado de contar de menos numa medição que já é escassa.
 */
export function registrarConversaoDeCadastro(sendTo: string | null): boolean {
  if (typeof window === 'undefined') return false

  const enviou = converterComGtag(
    (window as unknown as { gtag?: unknown }).gtag,
    sendTo,
    window.localStorage.getItem(CHAVE_CONSENTIMENTO),
    window.localStorage.getItem(CHAVE_CONVERSAO_ENVIADA) !== null,
  )

  if (enviou) {
    try {
      window.localStorage.setItem(CHAVE_CONVERSAO_ENVIADA, String(Date.now()))
    } catch {
      // Navegação privada e storage cheio lançam aqui. Perder a marca custa uma
      // contagem duplicada, e derrubar a página custaria a conta inteira.
    }
  }

  return enviou
}
