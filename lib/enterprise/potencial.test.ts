import { describe, expect, it } from 'vitest'

import { eventoQueRepresenta, potencialNoCard } from './potencial'

const evento = {
  prioridade: 90,
  data_inicio: '2026-11-23',
  organizador: 'Conselho Federal da OAB e OAB Bahia',
  contato_email: 'conferencianacional@oab.org.br',
  contato_telefone: null,
  publico_estimado: 20000,
}

describe('potencialNoCard', () => {
  it('o caso do print de 22/10: 90 vira 90% com três sinais curtos', () => {
    expect(potencialNoCard(evento, '2026-10-22')).toEqual({
      percentual: 90,
      resumo: 'Faltam 32 dias · Contato direto · Público 20 mil+',
    })
  })

  it('sem público, o terceiro sinal é o organizador', () => {
    const r = potencialNoCard({ ...evento, publico_estimado: null }, '2026-10-22')
    expect(r.resumo).toBe('Faltam 32 dias · Contato direto · Organizador identificado')
  })

  it('diz quando o evento já passou, em vez de contar dias negativos', () => {
    expect(potencialNoCard(evento, '2026-12-01').resumo.startsWith('Evento já passou')).toBe(true)
  })

  it('prende a prioridade entre 0 e 100 e trata nulo como 0', () => {
    expect(potencialNoCard({ ...evento, prioridade: null }, '2026-10-22').percentual).toBe(0)
    expect(potencialNoCard({ ...evento, prioridade: 140 }, '2026-10-22').percentual).toBe(100)
  })
})

describe('eventoQueRepresenta', () => {
  it('prefere o de maior potencial entre os que ainda vão acontecer', () => {
    const passado = { ...evento, data_inicio: '2026-01-01', prioridade: 99 }
    const futuroFraco = { ...evento, prioridade: 40 }
    const futuroForte = { ...evento, prioridade: 80 }
    expect(eventoQueRepresenta([passado, futuroFraco, futuroForte], '2026-10-22')).toBe(futuroForte)
  })

  it('cai no passado só quando não sobra futuro', () => {
    const passado = { ...evento, data_inicio: '2026-01-01' }
    expect(eventoQueRepresenta([passado], '2026-10-22')).toBe(passado)
    expect(eventoQueRepresenta([], '2026-10-22')).toBeNull()
  })
})
