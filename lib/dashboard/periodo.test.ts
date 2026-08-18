import { describe, expect, it } from 'vitest'

import { resolverPeriodo } from './periodo'

describe('resolverPeriodo', () => {
  // Meio-dia UTC = meio-dia em SP-3h ainda no mesmo dia civil, evita teste
  // acidentalmente sensível à borda da meia-noite.
  const agora = new Date('2026-08-13T15:00:00Z')

  it('sem preset nem datas devolve undefined, sem filtro, todo o histórico', () => {
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
  // normalizar mês/ano, subtrairDias usa Date.UTC, que já rola isso sozinho.
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

  it('hoje cobre só o dia corrente, do início ao fim', () => {
    const periodo = resolverPeriodo(agora, 'hoje', null, null)
    expect(periodo).toEqual({
      desde: '2026-08-13T00:00:00-03:00',
      ate: '2026-08-13T23:59:59.999-03:00',
    })
  })

  it('ontem cobre só o dia anterior, não o intervalo entre ontem e hoje', () => {
    const periodo = resolverPeriodo(agora, 'ontem', null, null)
    expect(periodo).toEqual({
      desde: '2026-08-12T00:00:00-03:00',
      ate: '2026-08-12T23:59:59.999-03:00',
    })
  })

  // 13/08 é uma quinta-feira; ontem cruzando virada de mês é o caso que
  // quebraria uma conta ingênua de "dia - 1" sem normalizar mês.
  it('ontem atravessa virada de mês corretamente', () => {
    const primeiroDeSetembro = new Date('2026-09-01T15:00:00Z')
    const periodo = resolverPeriodo(primeiroDeSetembro, 'ontem', null, null)
    expect(periodo).toEqual({
      desde: '2026-08-31T00:00:00-03:00',
      ate: '2026-08-31T23:59:59.999-03:00',
    })
  })

  it('mes_passado é o mês inteiro anterior, não os últimos 30 dias', () => {
    const periodo = resolverPeriodo(agora, 'mes_passado', null, null)
    expect(periodo).toEqual({
      desde: '2026-07-01T00:00:00-03:00',
      ate: '2026-07-31T23:59:59.999-03:00',
    })
  })

  it('mes_passado em janeiro volta para dezembro do ano anterior', () => {
    const emJaneiro = new Date('2026-01-15T15:00:00Z')
    const periodo = resolverPeriodo(emJaneiro, 'mes_passado', null, null)
    expect(periodo).toEqual({
      desde: '2025-12-01T00:00:00-03:00',
      ate: '2025-12-31T23:59:59.999-03:00',
    })
  })

  it('mes_passado em março cai em fevereiro com o número certo de dias', () => {
    const emMarco = new Date('2026-03-10T15:00:00Z')
    const periodo = resolverPeriodo(emMarco, 'mes_passado', null, null)
    // 2026 não é bissexto: fevereiro tem 28 dias.
    expect(periodo?.ate).toBe('2026-02-28T23:59:59.999-03:00')
  })

  it('trimestre começa no 1º mês do trimestre corrente, não 3 meses atrás', () => {
    // 13/08 está no 3º trimestre (jul-set): início é 1º de julho.
    const periodo = resolverPeriodo(agora, 'trimestre', null, null)
    expect(periodo).toEqual({
      desde: '2026-07-01T00:00:00-03:00',
      ate: '2026-08-13T23:59:59.999-03:00',
    })
  })

  it('trimestre em fevereiro cobre o 1º trimestre inteiro, não retrocede pro ano anterior', () => {
    const emFevereiro = new Date('2026-02-10T15:00:00Z')
    const periodo = resolverPeriodo(emFevereiro, 'trimestre', null, null)
    expect(periodo?.desde).toBe('2026-01-01T00:00:00-03:00')
  })
})
