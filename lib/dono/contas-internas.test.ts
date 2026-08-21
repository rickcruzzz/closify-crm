import { describe, expect, it } from 'vitest'

import { ehContaInterna } from './contas-internas'

/**
 * O defeito que motivou esta função, medido em 20/08: com a conta de revisão
 * do Google recebendo Pro de cortesia, a Central passou a dizer R$ 98/mês
 * quando a receita real era R$ 49. Painel de dinheiro que conta dinheiro que
 * ninguém pagou é pior que painel nenhum.
 */
describe('ehContaInterna', () => {
  it('reconhece a conta de revisão do Google', () => {
    expect(ehContaInterna('google.review@velofunil.com.br')).toBe(true)
  })

  it('não diferencia maiúscula nem espaço nas pontas', () => {
    expect(ehContaInterna('  Google.Review@VeloFunil.com.br ')).toBe(true)
  })

  // O risco real é o oposto do óbvio: marcar cliente de verdade como interno
  // esconderia receita e faria o dono achar que vende menos do que vende.
  it('não marca cliente de verdade como interno', () => {
    for (const email of [
      'fanimayara67@gmail.com',
      'testei122@gmaa2il.com',
      'contato@velofunil.com.br',
      'suporte@velofunil.com.br',
    ]) {
      expect(ehContaInterna(email)).toBe(false)
    }
  })

  it('aguenta ausência de e-mail', () => {
    expect(ehContaInterna(null)).toBe(false)
    expect(ehContaInterna(undefined)).toBe(false)
    expect(ehContaInterna('')).toBe(false)
  })
})
