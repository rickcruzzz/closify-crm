/**
 * O boleto mostrado dentro do produto, ao lado do Pix.
 *
 * Mesma razão do `pix.ts`: quem já decidiu pagar não precisa sair para outro
 * domínio, e a página do Asaas exibe o nome civil do titular em destaque (dado
 * da Receita para MEI, sem campo de nome fantasia desde 15/11/2023).
 *
 * A cobrança é a MESMA do Pix — `billingType: 'UNDEFINED'` no Asaas gera uma
 * cobrança que aceita qualquer método, e cada endpoint devolve a
 * representação correspondente. Medido contra a API em 23/08: a mesma
 * `pay_...` responde `pixQrCode`, `identificationField` e tem `bankSlipUrl`.
 * Não é preciso criar uma cobrança por método.
 */

/** Resposta de `GET /payments/{id}/identificationField`. */
export type LinhaDigitavelDoAsaas = {
  /** 47 dígitos, SEM formatação — medido na API. */
  identificationField?: string
  nossoNumero?: string
  /** Código de barras, 44 dígitos. Não é o que se digita no banco. */
  barCode?: string
}

export type BoletoParaExibir = {
  /** Com os pontos e espaços que o app do banco espera. */
  linhaFormatada: string
  /** Só dígitos — é isto que vai para a área de transferência. */
  linhaParaCopiar: string
}

/**
 * Formata a linha digitável no padrão FEBRABAN.
 *
 * Os 47 dígitos viram cinco blocos:
 *
 *     AAAAA.AAAAA BBBBB.BBBBBB CCCCC.CCCCCC D EEEEEEEEEEEEEE
 *
 * ## Por que formatar, se o banco aceita os dígitos crus
 *
 * Porque quase ninguém cola: muita gente **digita olhando**, especialmente
 * quem paga boleto em caixa eletrônico ou lê o número em voz alta para outra
 * pessoa. Uma sequência de 47 dígitos sem separador é onde o erro de digitação
 * nasce — e um dígito errado vira "boleto não encontrado", que a pessoa lê como
 * defeito do nosso produto.
 *
 * O que vai para a área de transferência continua sendo só os dígitos: app de
 * banco costuma recusar a versão pontuada.
 */
export function formatarLinhaDigitavel(linha: string): string {
  const digitos = linha.replace(/\D/g, '')

  // Fora do padrão de 47, devolve como veio: é melhor mostrar o número cru do
  // que uma formatação inventada que o banco vai recusar.
  if (digitos.length !== 47) return linha

  return [
    `${digitos.slice(0, 5)}.${digitos.slice(5, 10)}`,
    `${digitos.slice(10, 15)}.${digitos.slice(15, 21)}`,
    `${digitos.slice(21, 26)}.${digitos.slice(26, 32)}`,
    digitos.slice(32, 33),
    digitos.slice(33),
  ].join(' ')
}

/**
 * Prepara o boleto para a tela.
 *
 * Devolve `null` quando a linha não veio — pelo mesmo critério do Pix: falha na
 * exibição de um método não pode derrubar a página de quem está tentando pagar
 * pelos outros.
 */
export function prepararBoletoParaExibir(
  resposta: LinhaDigitavelDoAsaas | null,
): BoletoParaExibir | null {
  const linha = resposta?.identificationField?.trim()
  if (!linha) return null

  return {
    linhaFormatada: formatarLinhaDigitavel(linha),
    linhaParaCopiar: linha.replace(/\D/g, ''),
  }
}
