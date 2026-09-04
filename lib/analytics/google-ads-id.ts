/**
 * Higieniza o ID e o rótulo do Google Ads antes de eles virarem código.
 *
 * ## Por que este arquivo nasce junto da tag, e não depois
 *
 * É o espelho de `lib/analytics/pixel-id.ts`, que existe por causa de um
 * incidente real: o valor colado em `NEXT_PUBLIC_META_PIXEL_ID` na Vercel tinha
 * uma **quebra de linha no fim**, o ID é interpolado dentro de um script inline,
 * e o que chegava ao navegador era uma string literal partida em duas linhas —
 * `SyntaxError`. Como `next/script` injeta durante o commit do React, a exceção
 * subia até `app/global-error.tsx` e **o visitante via uma tela preta**.
 *
 * Aqui os dois valores entram nos mesmos dois lugares perigosos: o `AW-…` vai
 * para a **URL** do `gtag.js` e para dentro do script inline; o rótulo vai para
 * o `send_to` do mesmo script. Um `\n` invisível em qualquer um dos dois
 * reproduz o incidente de 24/08 inteiro.
 *
 * A defesa é a mesma de lá, e são duas, não uma:
 *
 * 1. **Limpar** espaço, quebra de linha, aspas e os invisíveis que vêm junto do
 *    copiar-e-colar de painel web.
 * 2. **Recusar** o que não casar com o formato. Valor errado que entra num
 *    script inline é injeção de código, não configuração.
 *
 * Sem tag, o site funciona e a campanha mede errado. Com tag quebrada, o site
 * não abre. Entre as duas, a escolha não tem dúvida.
 */

/**
 * Espaço, aspas e os invisíveis de copiar-e-colar — **só nas pontas**.
 *
 * ## Por que ancorado, e não em qualquer posição
 *
 * `lib/analytics/pixel-id.ts` limpa esses caracteres onde quer que estejam, e
 * ali isso é inofensivo: o resultado ainda precisa ser só dígitos, então juntar
 * `123 456` em `123456` recupera uma colagem torta sem inventar nada.
 *
 * Aqui não. O rótulo de conversão aceita letras, e `AbC dEf` viraria `AbCdEf` —
 * **um rótulo válido, diferente do que a pessoa colou**. A tag carregaria, a
 * chamada sairia, e o Google não acharia a ação de conversão: zero no
 * relatório, com tudo parecendo certo na tela.
 *
 * Entre recusar e adivinhar, recusa. Valor recusado não desenha tag nenhuma e
 * `auditar-descoberta.mjs` reclama; valor adivinhado gasta o orçamento inteiro
 * medindo nada. **Este caso foi achado pelo teste desta função, não previsto.**
 *
 * Escrito com escapes (`\u200B`) e não com os caracteres literais de propósito:
 * eles são invisíveis na inspeção do arquivo, e um formatador que os
 * reinterprete deixa a expressão silenciosamente diferente do que se leu.
 */
const LIXO_NO_INICIO = /^["'\s\u200B-\u200D\uFEFF]+/
const LIXO_NO_FIM = /["'\s\u200B-\u200D\uFEFF]+$/

/**
 * O ID da conta de conversão, no formato `AW-000000000`.
 *
 * ## Aceita com e sem o prefixo, e isso é decisão
 *
 * O painel do Google mostra o número em dois lugares diferentes: o trecho de
 * código traz `AW-123456789`, e a tela da ação de conversão traz só
 * `123456789`, rotulado "ID de conversão". As duas colagens são razoáveis, e
 * recusar a segunda produziria exatamente o silêncio que este arquivo existe
 * para evitar — variável preenchida, tag nunca carregando, ninguém avisado.
 *
 * A saída é sempre normalizada com o prefixo, para quem consome não precisar
 * saber de qual das duas telas o valor veio.
 */
export function googleAdsIdSeguro(bruto: string | undefined): string | null {
  if (!bruto) return null

  const limpo = bruto.replace(LIXO_NO_INICIO, '').replace(LIXO_NO_FIM, '')
  const semPrefixo = limpo.replace(/^AW-/i, '')

  if (!/^\d+$/.test(semPrefixo)) return null

  return `AW-${semPrefixo}`
}

/**
 * O rótulo da ação de conversão — a segunda metade do `send_to`.
 *
 * ## Por que é obrigatório, e não um extra
 *
 * `send_to` é `AW-123456789/AbC-dEfG_hIj`. Com o ID e sem o rótulo, o `gtag`
 * carrega, a chamada sai e **o Google não sabe qual conversão contar** — ela
 * simplesmente não aparece no relatório. Falha silenciosa de novo, e desta vez
 * com a tag funcionando, que é o pior tipo: tudo parece certo.
 *
 * Por isso `components/analytics/google-ads.tsx` exige os dois para renderizar
 * qualquer coisa.
 *
 * O alfabeto é o do próprio Google: letras, dígitos, `-` e `_`. Qualquer outra
 * coisa (uma barra colada junto do ID, um `send_to` inteiro no lugar do rótulo)
 * é recusada em vez de virar um `send_to` malformado.
 */
export function rotuloDeConversaoSeguro(bruto: string | undefined): string | null {
  if (!bruto) return null

  const limpo = bruto.replace(LIXO_NO_INICIO, '').replace(LIXO_NO_FIM, '')

  if (!/^[A-Za-z0-9_-]+$/.test(limpo)) return null

  return limpo
}
