/**
 * A forma canônica de um valor de UTM, usada pelos dois lados do funil.
 *
 * ## Por que não mora em `lib/dono/atribuicao.ts`, onde nasceu
 *
 * Quem lê `utm_content` são duas superfícies com públicos opostos: a Central do
 * Dono, para dizer qual peça trouxe cliente, e a página de cadastro, para
 * continuar a promessa do anúncio que a pessoa acabou de clicar. A segunda é
 * pública e a primeira devolve 404 em produção — importar `lib/dono/` de dentro
 * de uma página de cadastro acoplaria as duas pelo lado errado.
 *
 * Duas cópias divergem, e a que diverge em silêncio é a escrita na hora. Este
 * projeto já pagou isso em 29/08, quando uma expressão regular escrita à mão
 * classificou 23 empresas como externas sendo 6, e o número errado foi repetido
 * em quatro documentos. Uma função, dois consumidores.
 */

/**
 * A faixa Unicode dos acentos que o `NFD` separa da letra (U+0300 a U+036F).
 *
 * Montada por `fromCharCode` de propósito, em vez de escrita direta no regex:
 * são caracteres COMBINANTES, invisíveis no editor, e o formatador do projeto
 * os reescreve para a forma literal em toda gravação. `\p{M}` seria o certo e
 * exige a flag `u`, que o `target` deste projeto não aceita (TS1501).
 */
const MARCAS_COMBINANTES = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  'g',
)

/**
 * Reduz nome de campanha e valor de UTM à mesma forma comparável.
 *
 * Tudo que não é letra ou número vira separador, o acento sai, e a caixa é
 * baixada. `Velo Funil — aquisicao (cadastro)` e `aquisicao_cadastro` viram
 * `velo-funil-aquisicao-cadastro` e `aquisicao-cadastro`.
 *
 * Quem monta a URL do anúncio digita à mão e não pode escrever espaço,
 * travessão nem parêntese nela — então comparar por igualdade crua faria um
 * cliente pagante desaparecer do relatório, e faria o eco da promessa não
 * aparecer para quem clicou. Ver `casarComCampanha` e `ecoDaPeca`.
 */
export const chaveDeUtm = (valor: string | null | undefined): string =>
  (valor ?? '')
    .normalize('NFD')
    .replace(MARCAS_COMBINANTES, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
