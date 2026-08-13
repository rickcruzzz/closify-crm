import { describe, expect, it } from 'vitest'

import { resolverPeriodo } from './periodo'

describe('resolverPeriodo', () => {
  // Meio-dia UTC = meio-dia em SP-3h ainda no mesmo dia civil, evita teste
  // acidentalmente sensível à borda da meia-noite.
  const agora = new Date('2026-08-13T15:00:00Z')

  it('sem preset nem datas devolve undefined — sem filtro, todo o histórico', () => {
    expect(resolverPeriodo(agora, null, null, null)).toBeUndefined()
  })

  it('7d conta 7 dias pra trás a partir de hoje em SP, dia inteiro nas duas pontas', () => {
    const periodo = resolverPeriodo(agora, '7d', null, null)
    expect(periodo).toEqual({
      desde: '2026-08-06T00:00:00-03:00',
      ate: '2026-08-13T23:59:59.999-03:00',
    })
  })

  it('30d conta 30 dias pra trás', () => {
    const periodo = resolverPeriodo(agora, '30d', null, null)
    expect(periodo?.desde).toBe('2026-07-14T00:00:00-03:00')
  })

  it('mes começa no dia 1 do mês corrente', () => {
    const periodo = resolverPeriodo(agora, 'mes', null, null)
    expect(periodo).toEqual({
      desde: '2026-08-01T00:00:00-03:00',
      ate: '2026-08-13T23:59:59.999-03:00',
    })
  })

  it('ano começa em 1º de janeiro do ano corrente', () => {
    const periodo = resolverPeriodo(agora, 'ano', null, null)
    expect(periodo?.desde).toBe('2026-01-01T00:00:00-03:00')
  })

  // Virada de mês é o caso que quebra contas ingênuas de "dia - N" sem
  // normalizar mês/ano — subtrairDias usa Date.UTC, que já rola isso sozinho.
  it('7d atravessa virada de mês corretamente', () => {
    const inicioDeSetembro = new Date('2026-09-03T15:00:00Z')
    const periodo = resolverPeriodo(inicioDeSetembro, '7d', null, null)
    expect(periodo?.desde).toBe('2026-08-27T00:00:00-03:00')
  })

  it('datas livres têm prioridade sobre preset quando as duas vêm juntas', () => {
    const periodo = resolverPeriodo(agora, '7d', '2026-01-01', '2026-01-31')
    expect(periodo).toEqual({
      desde: '2026-01-01T00:00:00-03:00',
      ate: '2026-01-31T23:59:59.999-03:00',
    })
  })

  it('preset desconhecido cai no padrão sem filtro', () => {
    expect(resolverPeriodo(agora, 'bimestre', null, null)).toBeUndefined()
  })
})
