import { describe, expect, it } from 'vitest'

import { textoDaConversao } from './conversao'

describe('textoDaConversao', () => {
  /**
   * O caso que motivou o arquivo, medido na empresa de demonstração em
   * 26/08/2026: um único negócio fechado, e ele ganho. O card dizia "100%" e
   * nada mais.
   */
  it('100% de um único fechamento vem com a base ao lado', () => {
    expect(textoDaConversao(1, 1)).toEqual({
      valor: '100%',
      base: '1 de 1 negócio fechado',
    })
  })

  // `0%` afirma que as vendas fracassaram. Sem nenhum fechamento, a verdade é
  // que nenhuma chegou ao fim — e essas duas coisas não podem ter o mesmo
  // texto na tela.
  it('sem nenhum fechamento não mostra 0%, mostra travessão', () => {
    const { valor, base } = textoDaConversao(0, 0)
    expect(valor).not.toBe('0%')
    expect(valor).toBe('—')
    expect(base).toBe('nenhum negócio fechado ainda')
  })

  it('zero ganho entre fechados continua sendo 0%, com a base', () => {
    expect(textoDaConversao(0, 3)).toEqual({
      valor: '0%',
      base: '0 de 3 negócios fechados',
    })
  })

  it('plural acompanha o denominador, não o numerador', () => {
    expect(textoDaConversao(1, 4).base).toBe('1 de 4 negócios fechados')
    expect(textoDaConversao(1, 1).base).toBe('1 de 1 negócio fechado')
  })

  it('arredonda para inteiro, como o card sempre mostrou', () => {
    expect(textoDaConversao(1, 3).valor).toBe('33%')
    expect(textoDaConversao(2, 3).valor).toBe('67%')
  })

  /**
   * A trava de verdade: o tipo não permite valor sem base, e o teste garante
   * que nenhum caminho devolve base vazia. Percentual sozinho foi exatamente o
   * defeito.
   */
  it('nenhum resultado sai com a base vazia', () => {
    const casos: Array<[number, number]> = [
      [0, 0],
      [1, 1],
      [0, 1],
      [5, 5],
      [3, 10],
      [7, 2],
    ]
    for (const [ganhos, fechados] of casos) {
      expect(textoDaConversao(ganhos, fechados).base.length).toBeGreaterThan(0)
    }
  })

  // Contagem negativa não deveria existir, mas dividir por ela produziria
  // percentual negativo num card de resultado.
  it('denominador negativo cai no caso de "ainda não", não em conta torta', () => {
    expect(textoDaConversao(0, -2).valor).toBe('—')
  })
})
