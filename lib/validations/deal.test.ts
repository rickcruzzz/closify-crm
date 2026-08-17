import { describe, expect, it } from 'vitest'

import { dealSchema } from './deal'

/**
 * Regressão do prazo absurdo.
 *
 * O `<input type="date">` não reclama de ano digitado errado pelo teclado, e o
 * schema só exigia string não vazia. O banco acumulou prazos como `0111-11-11`
 * e `2007-11-11`, que a tela exibia como "atrasado há 9402 dias", e, no pior
 * caso, "atrasado há 699.346 dias".
 */

const base = {
  title: 'Consultoria anual',
  leadId: '11111111-1111-4111-8111-111111111111',
  value: 1000,
  stage: 'novo' as const,
  ownerId: '22222222-2222-4222-8222-222222222222',
}

describe('dealSchema, prazo', () => {
  it('aceita data plausível', () => {
    expect(dealSchema.safeParse({ ...base, dueDate: '2026-09-15' }).success).toBe(true)
  })

  it('recusa ano de dois ou três dígitos', () => {
    // `new Date(111, ...)` é remapeado para 2011, a origem do atraso absurdo.
    expect(dealSchema.safeParse({ ...base, dueDate: '0111-11-11' }).success).toBe(false)
  })

  it('recusa ano anterior a 2000 e posterior a 2100', () => {
    expect(dealSchema.safeParse({ ...base, dueDate: '1999-12-31' }).success).toBe(false)
    expect(dealSchema.safeParse({ ...base, dueDate: '2101-01-01' }).success).toBe(false)
  })

  it('aceita os extremos da faixa', () => {
    expect(dealSchema.safeParse({ ...base, dueDate: '2000-01-01' }).success).toBe(true)
    expect(dealSchema.safeParse({ ...base, dueDate: '2100-12-31' }).success).toBe(true)
  })

  it('recusa data que não existe no calendário', () => {
    // `new Date` empurra 31/02 para 3 de março em silêncio.
    expect(dealSchema.safeParse({ ...base, dueDate: '2026-02-31' }).success).toBe(false)
    expect(dealSchema.safeParse({ ...base, dueDate: '2026-13-01' }).success).toBe(false)
  })

  it('recusa formato fora de AAAA-MM-DD', () => {
    expect(dealSchema.safeParse({ ...base, dueDate: '15/09/2026' }).success).toBe(false)
    expect(dealSchema.safeParse({ ...base, dueDate: '' }).success).toBe(false)
  })
})

describe('dealSchema, demais campos', () => {
  it('recusa valor negativo', () => {
    const r = dealSchema.safeParse({ ...base, value: -1, dueDate: '2026-09-15' })
    expect(r.success).toBe(false)
  })

  /**
   * Regressão do pipeline bilionário.
   *
   * Sem teto, um negócio com valor 4232342343.24 (visto em produção) somava
   * direto no Dashboard e virava "Valor do Pipeline: R$ 8,5 bi" pra um
   * workspace com 4 negócios reais, parecia bug de cálculo, mas a soma
   * estava certa; faltava validação impedindo o valor absurdo de entrar.
   */
  it('recusa valor acima de R$100 milhões', () => {
    const r = dealSchema.safeParse({ ...base, value: 4_232_342_343.24, dueDate: '2026-09-15' })
    expect(r.success).toBe(false)
  })

  it('aceita valor no limite de R$100 milhões', () => {
    const r = dealSchema.safeParse({ ...base, value: 100_000_000, dueDate: '2026-09-15' })
    expect(r.success).toBe(true)
  })

  it('recusa etapa fora do enum', () => {
    const r = dealSchema.safeParse({
      ...base,
      stage: 'inventada',
      dueDate: '2026-09-15',
    })
    expect(r.success).toBe(false)
  })

  it('recusa lead que não é uuid', () => {
    const r = dealSchema.safeParse({ ...base, leadId: 'abc', dueDate: '2026-09-15' })
    expect(r.success).toBe(false)
  })
})
