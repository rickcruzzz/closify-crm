import { describe, expect, it } from 'vitest'

import { compararComAnterior, janelaAnterior } from './variacao'

describe('janelaAnterior', () => {
  it('devolve a janela imediatamente anterior, do MESMO tamanho', () => {
    const anterior = janelaAnterior({
      desde: '2026-09-10T00:00:00.000Z',
      ate: '2026-09-17T00:00:00.000Z',
    })!
    expect(anterior.desde).toBe('2026-09-03T00:00:00.000Z')
    // 1ms antes do início atual: sem isso as duas janelas se tocariam e um
    // negócio criado na virada contaria nos dois lados.
    expect(anterior.ate).toBe('2026-09-09T23:59:59.999Z')
  })

  it('SEM periodo escolhido nao existe anterior', () => {
    // O anterior a "todo o período" é vazio, e toda métrica subiria infinito
    // por cima de zero.
    expect(janelaAnterior(null)).toBeNull()
  })

  it('periodo invertido ou de duracao zero nao produz janela', () => {
    expect(
      janelaAnterior({ desde: '2026-09-17T00:00:00Z', ate: '2026-09-10T00:00:00Z' }),
    ).toBeNull()
    expect(
      janelaAnterior({ desde: '2026-09-10T00:00:00Z', ate: '2026-09-10T00:00:00Z' }),
    ).toBeNull()
    expect(
      janelaAnterior({ desde: 'nao e data', ate: '2026-09-10T00:00:00Z' }),
    ).toBeNull()
  })
})

describe('compararComAnterior', () => {
  it('calcula o crescimento percentual', () => {
    expect(compararComAnterior(107, 100, 'percentual')).toEqual({
      texto: '+7%',
      direcao: 'subiu',
    })
    expect(compararComAnterior(96, 100, 'percentual')).toEqual({
      texto: '-4%',
      direcao: 'desceu',
    })
  })

  it('usa VIRGULA decimal e uma casa', () => {
    expect(compararComAnterior(1074, 1000, 'percentual')!.texto).toBe('+7,4%')
  })

  it('SAIR DE ZERO nao e crescimento infinito', () => {
    // Ir de 0 para 5 não é "+500%", é "não havia nada antes". O card não
    // mostra a linha em vez de afirmar um número.
    expect(compararComAnterior(5, 0, 'percentual')).toBeNull()
    expect(compararComAnterior(0, 0, 'percentual')).toBeNull()
  })

  it('ponto percentual NAO e por cento', () => {
    // De 40% para 50% são DEZ PONTOS e um crescimento de 25%. Os dois números
    // são certos e dizem coisas diferentes.
    expect(compararComAnterior(50, 40, 'pontos')).toEqual({
      texto: '+10 p.p.',
      direcao: 'subiu',
    })
    expect(compararComAnterior(50, 40, 'percentual')).toEqual({
      texto: '+25%',
      direcao: 'subiu',
    })
  })

  it('em PONTOS, base zero e legitima', () => {
    // Ir de 0% para 30% são trinta pontos, e isso é verdade — ao contrário do
    // percentual de crescimento sobre zero.
    expect(compararComAnterior(30, 0, 'pontos')).toEqual({
      texto: '+30 p.p.',
      direcao: 'subiu',
    })
  })

  it('diferenca que arredonda a zero le como ESTAVEL', () => {
    expect(compararComAnterior(1000, 1000, 'percentual')!.direcao).toBe('estavel')
    expect(compararComAnterior(1000.4, 1000, 'percentual')!.direcao).toBe('estavel')
  })

  it('numero invalido nao vira comparacao', () => {
    expect(compararComAnterior(Number.NaN, 10, 'percentual')).toBeNull()
    expect(compararComAnterior(10, Number.POSITIVE_INFINITY, 'percentual')).toBeNull()
  })
})
