import { describe, expect, it } from 'vitest'

import { ordenarPorRelevancia } from '@/lib/calendario/ordenar-por-relevancia'
import type { TaskRow } from '@/lib/tasks/types'

/** 19/08/2026, 14h em São Paulo (17h UTC). O "agora" de todos os casos. */
const AGORA = new Date('2026-08-19T17:00:00Z')

function tarefa(campos: { id: string; hora: string; concluida?: boolean }): TaskRow {
  return {
    id: campos.id,
    title: `Tarefa ${campos.id}`,
    type: 'ligacao',
    due_at: `2026-08-19T${campos.hora}:00Z`,
    done_at: campos.concluida ? '2026-08-19T12:00:00Z' : null,
    lead_id: null,
    deal_id: null,
    assignee_id: null,
    lead_name: null,
    lead_phone: null,
  conversa_id: null,
    assignee_name: null,
  }
}

const ids = (tarefas: TaskRow[]) => tarefas.map((t) => t.id)

describe('ordenarPorRelevancia', () => {
  it('põe a vencida à frente de concluídas mais cedo — o defeito que motivou a função', () => {
    // Exatamente o caso do print que expôs o problema: três tarefas concluídas
    // de manhã e uma vencida à tarde. Com ordem só cronológica, as três
    // concluídas ocupavam os 3 chips visíveis do modo Mês e a vencida sumia
    // atrás do "+1" — a única que ainda cobrava ação era a única escondida.
    const doDia = [
      tarefa({ id: 'concluida-9h', hora: '12', concluida: true }),
      tarefa({ id: 'concluida-10h', hora: '13', concluida: true }),
      tarefa({ id: 'concluida-11h', hora: '14', concluida: true }),
      tarefa({ id: 'vencida-13h', hora: '16' }),
    ]

    const ordenada = ordenarPorRelevancia(doDia, AGORA)

    expect(ordenada[0]!.id).toBe('vencida-13h')
    // O que de fato importa: sobreviver ao corte em 3 do `month-view`.
    expect(ids(ordenada.slice(0, 3))).toContain('vencida-13h')
  })

  it('ordena vencida antes de pendente, e pendente antes de concluída', () => {
    const doDia = [
      tarefa({ id: 'concluida', hora: '12', concluida: true }),
      tarefa({ id: 'pendente', hora: '20' }),
      tarefa({ id: 'vencida', hora: '15' }),
    ]

    expect(ids(ordenarPorRelevancia(doDia, AGORA))).toEqual([
      'vencida',
      'pendente',
      'concluida',
    ])
  })

  it('mantém a ordem por hora dentro da mesma faixa', () => {
    // Sem isto o dia deixaria de se ler como agenda: a faixa decide o grupo,
    // mas dentro do grupo quem manda é o relógio.
    const doDia = [
      tarefa({ id: 'pendente-18h', hora: '21' }),
      tarefa({ id: 'pendente-16h', hora: '19' }),
      tarefa({ id: 'pendente-20h', hora: '23' }),
    ]

    expect(ids(ordenarPorRelevancia(doDia, AGORA))).toEqual([
      'pendente-16h',
      'pendente-18h',
      'pendente-20h',
    ])
  })

  it('trata como vencida a tarefa de hora já passada NO MESMO DIA', () => {
    // Mesma regra de `urgenciaDaProximaAcao` e de `classificar`: compara
    // instante, não dia. Comparar por dia deixaria a tarefa das 9h parecer
    // pendente às 15h, e ela é justamente a que foi esquecida hoje.
    const doDia = [
      tarefa({ id: 'ainda-vai', hora: '20' }),
      tarefa({ id: 'passou-hoje', hora: '12' }),
    ]

    expect(ids(ordenarPorRelevancia(doDia, AGORA))).toEqual(['passou-hoje', 'ainda-vai'])
  })

  it('não considera vencida a tarefa concluída com prazo no passado', () => {
    // Concluída não é cobrança: já aconteceu. Sem esta separação, um dia
    // inteiro de tarefas feitas apareceria como um dia inteiro de atraso.
    const doDia = [
      tarefa({ id: 'feita-atrasada', hora: '12', concluida: true }),
      tarefa({ id: 'pendente-futura', hora: '22' }),
    ]

    expect(ids(ordenarPorRelevancia(doDia, AGORA))).toEqual([
      'pendente-futura',
      'feita-atrasada',
    ])
  })

  it('devolve um array novo, sem mutar o recebido', () => {
    // O array vem do `Map` memoizado de `agruparTarefasPorDia`, reusado pelos
    // modos Semana e Agenda — que mostram o dia inteiro sem corte e por isso
    // querem a ordem cronológica pura. Ordenar no lugar contaminaria os dois.
    const doDia = [tarefa({ id: 'b', hora: '20' }), tarefa({ id: 'a', hora: '15' })]
    const original = ids(doDia)

    const ordenada = ordenarPorRelevancia(doDia, AGORA)

    expect(ordenada).not.toBe(doDia)
    expect(ids(doDia)).toEqual(original)
  })
})
