import { describe, expect, it } from 'vitest'
import { contatoDoEventoCompleto, conferirDestinatarioDoEvento } from './contato'

describe('restrição de contatos do Radar', () => {
  it('exige e-mail e telefone válidos juntos', () => {
    expect(contatoDoEventoCompleto({ contato_email: 'comercial@evento.com.br', contato_telefone: '(71) 99999-1234' })).toBe(true)
    for (const contato of [
      {}, { contato_email: 'comercial@evento.com.br' }, { contato_telefone: '(71) 99999-1234' },
      { contato_email: 'sem-email', contato_telefone: '(71) 99999-1234' },
      { contato_email: 'comercial@evento.com.br', contato_telefone: '1000000000' },
      { contato_email: 'logo@2x.png', contato_telefone: '(71) 99999-1234' },
      { contato_email: ' ', contato_telefone: ' ' },
    ]) expect(contatoDoEventoCompleto(contato)).toBe(false)
  })
  it('retira incompletos da lista sem alterar os registros de origem', () => {
    const incompleto = { contato_email: null, contato_telefone: null }
    const completo = { contato_email: 'comercial@evento.com.br', contato_telefone: '5571999991234' }
    const lista = [incompleto, completo]
    expect(lista.filter(contatoDoEventoCompleto)).toEqual([completo])
    expect(lista).toEqual([incompleto, completo])
  })
})

describe('destinatário do evento', () => {
  it('aceita formatos diferentes do mesmo número e retorna o destino canônico', () => {
    expect(conferirDestinatarioDoEvento('(71) 99999-1234', '+55 71 99999-1234')).toEqual({ ok: true, telefone: '5571999991234' })
  })
  it('não troca por contato de mesmo e-mail com telefone diferente', () => {
    const r = conferirDestinatarioDoEvento('71999991234', '71988887777')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain('diferente')
  })
  it.each([[null, '71999991234'], ['71999991234', null], ['1234567890', '71999991234']])('recusa número ausente ou inválido', (a, b) => {
    expect(conferirDestinatarioDoEvento(a, b).ok).toBe(false)
  })
})
