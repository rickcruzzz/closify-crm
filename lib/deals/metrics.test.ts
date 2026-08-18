import { describe, expect, it } from 'vitest'

import { formatarValorDeNegocio } from './metrics'

/**
 * `Intl` separa "R$" do número com espaço NÃO-QUEBRÁVEL (U+00A0), não com
 * espaço comum. As duas strings são idênticas na tela e diferentes para
 * `toBe`, o que faz um teste correto falhar com "expected 'R$ 3.500,00' to be
 * 'R$ 3.500,00'" — mensagem que não mostra a diferença. Normalizar aqui deixa
 * o teste falar de valor, que é o que ele existe para checar.
 */
const semNbsp = (v: string) => v.replace(/ /g, ' ')

describe('formatarValorDeNegocio', () => {
  // O defeito que motivou: existe em produção um negócio de
  // R$ 4.232.342.343,24 — dezenove caracteres — e ele virava a coisa mais
  // pesada do card e do cabeçalho da coluna.
  it('abrevia bilhão em vez de mostrar dezenove caracteres', () => {
    const abreviado = formatarValorDeNegocio(4232342343.24)
    expect(abreviado).toMatch(/bi/)
    expect(abreviado.length).toBeLessThan(12)
  })

  it('abrevia milhão', () => {
    expect(formatarValorDeNegocio(112428442)).toMatch(/mi/)
  })

  // O ticket típico do público não pode perder precisão: agência que vende
  // R$ 3.500 precisa ver R$ 3.500, não "R$ 3,5 mil".
  it('deixa o valor típico intacto, com centavos', () => {
    expect(semNbsp(formatarValorDeNegocio(3500))).toBe('R$ 3.500,00')
    expect(semNbsp(formatarValorDeNegocio(12500))).toBe('R$ 12.500,00')
  })

  // `formatCompactBRL`, que já existia, devolve "R$ 1 mi" para 999.999:
  // arredonda para cima e afirma um milhão onde não há. O limiar existe para
  // que valores logo abaixo dele sigam exatos.
  it('não arredonda para cima logo abaixo do limiar', () => {
    expect(semNbsp(formatarValorDeNegocio(999999))).toBe('R$ 999.999,00')
  })

  // Com uma casa decimal, 4.232.342.343 e 4.290.000.000 viram os dois
  // "R$ 4,2 bi", e o board deixa de distinguir cinquenta milhões de diferença.
  it('mantém duas casas para não colapsar valores distintos', () => {
    expect(formatarValorDeNegocio(4232342343)).not.toBe(formatarValorDeNegocio(4290000000))
  })

  it('trata o próprio limiar como abreviado', () => {
    expect(formatarValorDeNegocio(1_000_000)).toMatch(/mi/)
  })
})
