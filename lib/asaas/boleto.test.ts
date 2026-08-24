import { describe, expect, it } from 'vitest'

import { formatarLinhaDigitavel, prepararBoletoParaExibir } from './boleto'

/** Linha real devolvida pela API em 23/08, 47 dígitos, sem formatação. */
const LINHA_REAL = '46191110000000000004275766869012115740000004900'

describe('linha digitável', () => {
  it('formata nos cinco blocos do padrão FEBRABAN', () => {
    expect(formatarLinhaDigitavel(LINHA_REAL)).toBe(
      '46191.11000 00000.000042 75766.869012 1 15740000004900',
    )
  })

  /**
   * A formatação é para os OLHOS. Muita gente digita olhando em vez de colar —
   * quem paga em caixa eletrônico, ou lê o número em voz alta para outra
   * pessoa. 47 dígitos sem separador é onde o erro nasce, e um dígito errado
   * vira "boleto não encontrado", que a pessoa lê como defeito do nosso
   * produto.
   */
  it('o que se copia continua sendo só dígitos', () => {
    const boleto = prepararBoletoParaExibir({ identificationField: LINHA_REAL })
    expect(boleto?.linhaParaCopiar).toBe(LINHA_REAL)
    expect(boleto?.linhaParaCopiar).toMatch(/^\d{47}$/)
    // App de banco costuma recusar a versão pontuada.
    expect(boleto?.linhaParaCopiar).not.toContain('.')
  })

  /**
   * Formatar o que não tem 47 dígitos produziria um número que o banco recusa,
   * e a pessoa culparia o produto. Mostrar cru é feio e funciona.
   */
  it('fora do padrão, devolve como veio em vez de inventar formato', () => {
    expect(formatarLinhaDigitavel('123')).toBe('123')
    expect(formatarLinhaDigitavel('')).toBe('')
  })

  it('linha que já vem pontuada é normalizada, não duplicada', () => {
    const jaPontuada = '46191.11000 00000.000042 75766.869012 1 15740000004900'
    expect(formatarLinhaDigitavel(jaPontuada)).toBe(jaPontuada)
  })
})

describe('preparar o boleto', () => {
  it('resposta sem linha devolve null em vez de estourar', () => {
    expect(prepararBoletoParaExibir(null)).toBeNull()
    expect(prepararBoletoParaExibir({})).toBeNull()
    expect(prepararBoletoParaExibir({ identificationField: '   ' })).toBeNull()
  })

  it('devolve as duas formas: uma para ler, outra para colar', () => {
    const boleto = prepararBoletoParaExibir({ identificationField: LINHA_REAL })
    expect(boleto?.linhaFormatada).toContain('.')
    expect(boleto?.linhaParaCopiar).not.toContain('.')
  })
})
