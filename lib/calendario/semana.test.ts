import { describe, expect, it } from 'vitest'

import { diasDaSemana, rotuloCurtoDoDia } from './semana'

describe('diasDaSemana', () => {
  it('devolve 7 dias, domingo a sábado, contendo o dia âncora', () => {
    // 18/08/2026 é uma terça-feira.
    const dias = diasDaSemana('2026-08-18')
    expect(dias).toHaveLength(7)
    expect(dias[0]).toBe('2026-08-16') // domingo
    expect(dias[6]).toBe('2026-08-22') // sábado
    expect(dias).toContain('2026-08-18')
  })

  it('âncora no próprio domingo não recua uma semana', () => {
    const dias = diasDaSemana('2026-08-16')
    expect(dias[0]).toBe('2026-08-16')
  })

  it('âncora no sábado inclui os 6 dias anteriores da mesma semana', () => {
    const dias = diasDaSemana('2026-08-22')
    expect(dias[0]).toBe('2026-08-16')
    expect(dias[6]).toBe('2026-08-22')
  })

  it('atravessa virada de mês corretamente', () => {
    // 1º de setembro de 2026 é terça-feira.
    const dias = diasDaSemana('2026-09-01')
    expect(dias[0]).toBe('2026-08-30')
    expect(dias[6]).toBe('2026-09-05')
  })
})

describe('rotuloCurtoDoDia', () => {
  it('formata dia e mês abreviado, sem o "de" nem o ponto do Intl', () => {
    expect(rotuloCurtoDoDia('2026-08-18')).toBe('18 ago')
  })

  it('janeiro formata corretamente', () => {
    expect(rotuloCurtoDoDia('2026-01-05')).toBe('5 jan')
  })
})
