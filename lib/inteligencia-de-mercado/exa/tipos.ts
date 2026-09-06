/**
 * O formato da resposta do Exa, declarado LOCALMENTE.
 *
 * Não importa tipo de fora e não exporta estes para fora: eles descrevem um
 * contrato de terceiro, que muda quando o terceiro quiser. Vazando daqui, uma
 * mudança do Exa viraria alteração em arquivo do produto.
 *
 * Conferido contra a resposta real em 06/09/2026: `results[]` traz `id`,
 * `title`, `url`, e `costDollars.total` vem no topo.
 */

export type ResultadoBruto = {
  id?: string
  title?: string | null
  url?: string
  publishedDate?: string | null
  text?: string | null
  highlights?: string[] | null
}

export type RespostaBruta = {
  results?: ResultadoBruto[]
  costDollars?: { total?: number } | null
}
