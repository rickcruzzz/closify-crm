import { describe, expect, it } from 'vitest'

import { agruparPorPrazo, classificar, diaEmSaoPaulo, rotuloDePrazo } from './buckets'
import type { TaskRow } from './types'

function tarefa(dueAt: string, extra: Partial<TaskRow> = {}): TaskRow {
  return {
    id: dueAt,
    title: 'Ligar',
    type: 'ligacao',
    due_at: dueAt,
    done_at: null,
    lead_id: 'lead-1',
    deal_id: null,
    assignee_id: 'user-1',
    lead_name: 'Studio Vega',
    assignee_name: 'Orlando',
    ...extra,
  }
}

describe('diaEmSaoPaulo', () => {
  // O defeito que este arquivo existe para impedir: a Vercel roda em UTC, e
  // 23h de São Paulo já é o dia seguinte lá. `toISOString().slice(0,10)` daria
  // 12/08 e mandaria a tarefa de hoje à noite para o grupo "Depois".
  it('resolve o dia no fuso de São Paulo, não no do servidor', () => {
    // 11/08/2026 23:30 em São Paulo = 12/08/2026 02:30 UTC.
    const instante = new Date('2026-08-12T02:30:00.000Z')

    expect(instante.toISOString().slice(0, 10)).toBe('2026-08-12')
    expect(diaEmSaoPaulo(instante)).toBe('2026-08-11')
  })

  it('resolve a virada do dia no fuso certo', () => {
    // 12/08/2026 00:10 em São Paulo = 12/08/2026 03:10 UTC.
    expect(diaEmSaoPaulo(new Date('2026-08-12T03:10:00.000Z'))).toBe('2026-08-12')
  })
})

describe('classificar', () => {
  // 11/08/2026 15:00 em São Paulo.
  const agora = new Date('2026-08-11T18:00:00.000Z')

  // Comparar por DIA mandaria esta para "Hoje" e a pessoa não veria que já
  // furou o compromisso. Atraso é comparação de instante.
  it('trata como atrasada a tarefa de hoje cedo que já passou da hora', () => {
    expect(classificar(tarefa('2026-08-11T12:00:00.000Z'), agora)).toBe('atrasada')
  })

  it('mantém em hoje a tarefa que ainda vai vencer hoje', () => {
    expect(classificar(tarefa('2026-08-11T22:00:00.000Z'), agora)).toBe('hoje')
  })

  it('separa os próximos 7 dias do que vem depois', () => {
    expect(classificar(tarefa('2026-08-12T13:00:00.000Z'), agora)).toBe('semana')
    expect(classificar(tarefa('2026-08-18T13:00:00.000Z'), agora)).toBe('semana')
    expect(classificar(tarefa('2026-08-19T13:00:00.000Z'), agora)).toBe('depois')
  })

  // 22h de São Paulo: já é o dia seguinte em UTC. Sem o fuso, a tarefa de
  // amanhã cedo cairia em "hoje" e a de hoje à noite em "depois".
  it('acerta os grupos depois das 21h de São Paulo', () => {
    const noite = new Date('2026-08-12T01:00:00.000Z') // 11/08 22:00 em SP

    expect(classificar(tarefa('2026-08-12T02:00:00.000Z'), noite)).toBe('hoje')
    expect(classificar(tarefa('2026-08-12T12:00:00.000Z'), noite)).toBe('semana')
  })
})

describe('agruparPorPrazo', () => {
  const agora = new Date('2026-08-11T18:00:00.000Z')

  it('ordena cada grupo do mais urgente ao menos', () => {
    const grupos = agruparPorPrazo(
      [
        tarefa('2026-08-11T23:00:00.000Z'),
        tarefa('2026-08-11T19:00:00.000Z'),
        tarefa('2026-08-11T21:00:00.000Z'),
      ],
      agora,
    )

    expect(grupos.hoje.map((t) => t.due_at)).toEqual([
      '2026-08-11T19:00:00.000Z',
      '2026-08-11T21:00:00.000Z',
      '2026-08-11T23:00:00.000Z',
    ])
  })

  it('descarta tarefa concluída, que não pertence a grupo nenhum', () => {
    const grupos = agruparPorPrazo(
      [
        tarefa('2026-08-11T10:00:00.000Z', { done_at: '2026-08-11T11:00:00.000Z' }),
        tarefa('2026-08-11T12:00:00.000Z'),
      ],
      agora,
    )

    expect(grupos.atrasada).toHaveLength(1)
    expect(grupos.atrasada[0]!.due_at).toBe('2026-08-11T12:00:00.000Z')
  })

  it('devolve os quatro grupos mesmo sem nenhuma tarefa', () => {
    expect(agruparPorPrazo([], agora)).toEqual({
      atrasada: [],
      hoje: [],
      semana: [],
      depois: [],
    })
  })
})

describe('rotuloDePrazo', () => {
  const agora = new Date('2026-08-11T18:00:00.000Z') // 15h em SP

  it('fala em dia de calendário, não em horas corridas', () => {
    expect(rotuloDePrazo('2026-08-11T22:00:00.000Z', agora)).toBe('hoje')
    expect(rotuloDePrazo('2026-08-12T13:00:00.000Z', agora)).toBe('amanhã')
    expect(rotuloDePrazo('2026-08-14T13:00:00.000Z', agora)).toBe('em 3 dias')
  })

  it('distingue o atraso de hoje do atraso de dias anteriores', () => {
    expect(rotuloDePrazo('2026-08-11T12:00:00.000Z', agora)).toBe('atrasada hoje')
    expect(rotuloDePrazo('2026-08-10T12:00:00.000Z', agora)).toBe('atrasada há 1 dia')
    expect(rotuloDePrazo('2026-08-08T12:00:00.000Z', agora)).toBe('atrasada há 3 dias')
  })
})
