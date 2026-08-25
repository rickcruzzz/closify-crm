import { describe, expect, it } from 'vitest'

import { estadoDoVencimento, textoDeQuantoFalta } from './vencimento'

/**
 * Meio-dia em São Paulo, para nenhum teste depender de fração de hora
 * empurrando a conta para o dia seguinte.
 */
const AGORA = new Date('2026-08-25T15:00:00Z')

function emDias(dias: number): string {
  return new Date(AGORA.getTime() + dias * 24 * 60 * 60 * 1000).toISOString()
}

describe('estadoDoVencimento', () => {
  it('conta os dias que faltam', () => {
    const estado = estadoDoVencimento(emDias(30), AGORA)
    expect(estado?.diasRestantes).toBe(30)
    expect(estado?.vencido).toBe(false)
    expect(estado?.destacar).toBe(false)
  })

  /**
   * A fronteira, com número literal de propósito.
   *
   * Escrever `AVISAR_A_PARTIR_DE` aqui faria o teste concordar com qualquer
   * valor da constante. O número cru é o que obriga quem mudar o limiar a olhar
   * também a tarja do trial e o cron de aviso, que leem o mesmo número.
   */
  it('destaca a partir de 4 dias, e não em 5', () => {
    expect(estadoDoVencimento(emDias(4), AGORA)?.destacar).toBe(true)
    expect(estadoDoVencimento(emDias(5), AGORA)?.destacar).toBe(false)
  })

  it('hoje ainda conta como zero, não como vencido', () => {
    const estado = estadoDoVencimento(emDias(0), AGORA)
    expect(estado?.diasRestantes).toBe(0)
    expect(estado?.vencido).toBe(false)
    expect(estado?.destacar).toBe(true)
  })

  // Vencido tem texto próprio. Pintar de laranja algo que já passou confunde
  // com o que ainda dá para evitar.
  it('vencido não destaca', () => {
    const estado = estadoDoVencimento(emDias(-2), AGORA)
    expect(estado?.vencido).toBe(true)
    expect(estado?.destacar).toBe(false)
    expect(estado?.diasRestantes).toBe(-2)
  })

  it('escreve a data por extenso em português', () => {
    const estado = estadoDoVencimento('2026-09-24T12:00:00Z', AGORA)
    expect(estado?.dataPorExtenso).toBe('24 de setembro de 2026')
  })

  /**
   * O servidor da Vercel roda em UTC, e às 21h de São Paulo já é o dia seguinte
   * lá. Sem o fuso, uma assinatura que vence hoje à noite apareceria como
   * "venceu ontem" para quem abrisse a tela de madrugada.
   */
  it('conta pelo calendário de São Paulo, não pelo do servidor', () => {
    // 25/08 às 23h em São Paulo é 26/08 às 02h em UTC.
    const noiteEmSaoPaulo = new Date('2026-08-26T02:00:00Z')
    const estado = estadoDoVencimento('2026-08-26T02:30:00Z', noiteEmSaoPaulo)
    expect(estado?.diasRestantes).toBe(0)
    expect(estado?.vencido).toBe(false)
  })

  // Assinatura que nunca foi paga tem `current_period_end` nulo. É estado
  // legítimo: a tela não mostra a linha, em vez de escrever "Invalid Date".
  it('devolve null para ausente ou ilegível', () => {
    expect(estadoDoVencimento(null, AGORA)).toBeNull()
    expect(estadoDoVencimento(undefined, AGORA)).toBeNull()
    expect(estadoDoVencimento('', AGORA)).toBeNull()
    expect(estadoDoVencimento('nao-e-data', AGORA)).toBeNull()
  })
})

describe('textoDeQuantoFalta', () => {
  it('usa palavra, não número, quando falta pouco', () => {
    expect(textoDeQuantoFalta(estadoDoVencimento(emDias(0), AGORA)!)).toBe('vence hoje')
    expect(textoDeQuantoFalta(estadoDoVencimento(emDias(1), AGORA)!)).toBe('vence amanhã')
  })

  it('conta os dias quando falta mais de um', () => {
    expect(textoDeQuantoFalta(estadoDoVencimento(emDias(12), AGORA)!)).toBe('faltam 12 dias')
  })

  it('fala no passado quando já venceu', () => {
    expect(textoDeQuantoFalta(estadoDoVencimento(emDias(-1), AGORA)!)).toBe('venceu ontem')
    expect(textoDeQuantoFalta(estadoDoVencimento(emDias(-5), AGORA)!)).toBe('venceu há 5 dias')
  })

  // "faltam 1 dias" e "venceu há 1 dias" são os erros clássicos de contagem
  // gerada. Cada caso de singular tem texto próprio.
  it('nunca concorda errado no singular', () => {
    for (const dias of [-1, 0, 1]) {
      const texto = textoDeQuantoFalta(estadoDoVencimento(emDias(dias), AGORA)!)
      expect(texto, `dia ${dias}`).not.toMatch(/\b1 dias\b/)
    }
  })
})
