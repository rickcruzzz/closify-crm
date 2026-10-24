import { describe, expect, it } from 'vitest'

import { contatoEmOutraFonte, extrairEvento, palavrasDoEvento } from './extracao'

/**
 * O contato em OUTRA página pública do evento (25/10).
 *
 * A varredura real de 22/10 trouxe 7 eventos válidos e só 1 com e-mail E
 * telefone na própria página. A busca dirigida achou os dois em 4 de 5. Estes
 * testes travam as condições em que esse contato é aceito, porque o erro caro
 * aqui é mandar mensagem para a empresa errada.
 */

const anamt = { nome: '23º Congresso Nacional Anamt', fonteUrl: 'https://congresso2026.anamt.org.br/' }

describe('palavrasDoEvento', () => {
  it('tira número, acento e palavra genérica', () => {
    expect(palavrasDoEvento('23º Congresso Nacional Anamt')).toEqual(['anamt'])
    expect(palavrasDoEvento('CBCTA2026')).toEqual(['cbcta'])
    expect(palavrasDoEvento('BTX 26 | Bahia Tech Experience')).toEqual(['btx', 'tech', 'experience'])
  })
})

describe('contatoEmOutraFonte', () => {
  it('aceita a página da organizadora que cita o evento (caso real da Anamt)', () => {
    const r = contatoEmOutraFonte(
      [{ url: 'https://www.anamt.org.br/eventos', texto: 'Congresso Anamt 2026. Fale com eventos@anamt.org.br ou +55 (11) 3251-0849.' }],
      anamt,
    )
    expect(r).toEqual({ email: 'eventos@anamt.org.br', telefone: '551132510849', url: 'https://www.anamt.org.br/eventos' })
  })

  it('aceita página de outro domínio que cita o evento', () => {
    const r = contatoEmOutraFonte(
      [{ url: 'https://gt5.com.br/cbcta', texto: 'CBCTA 2026: comercial@gt5.com.br, 71 2102-6604' }],
      { nome: 'CBCTA2026', fonteUrl: 'https://cbcta2026.com.br/' },
    )
    expect(r?.email).toBe('comercial@gt5.com.br')
  })

  it('recusa página que NÃO é do evento, mesmo com contato completo', () => {
    const r = contatoEmOutraFonte(
      [{ url: 'https://outra-feira.com.br', texto: 'Congresso Nacional de Odontologia. vendas@outra.com.br (71) 3333-4444' }],
      anamt,
    )
    expect(r).toBeNull()
  })

  it('com uma palavra distintiva só, exige o nome inteiro (caso real do Bahia Connect)', () => {
    const evento = { nome: 'Bahia Connect 2027', fonteUrl: 'https://bahiaconnect.com.br/' }
    const coffee = { url: 'https://www.coffeeconnect.com.br/', texto: 'Coffee Connect. comercial2@bahiafarmshow.com.br (77) 3613-1234' }
    expect(contatoEmOutraFonte([coffee], evento)).toBeNull()
    const certa = { url: 'https://agenda.com.br/x', texto: 'Bahia Connect 2027: contato@bc.com.br (71) 3333-4444' }
    expect(contatoEmOutraFonte([certa], evento)?.email).toBe('contato@bc.com.br')
  })

  it('exige e-mail e telefone NA MESMA página', () => {
    const r = contatoEmOutraFonte(
      [
        { url: 'https://anamt.org.br/a', texto: 'Anamt: eventos@anamt.org.br' },
        { url: 'https://anamt.org.br/b', texto: 'Anamt: (11) 3251-0849' },
      ],
      anamt,
    )
    expect(r).toBeNull()
  })

  it('prefere e-mail de função e pula noreply e imagem', () => {
    const r = contatoEmOutraFonte(
      [{ url: 'https://anamt.org.br/x', texto: 'Anamt noreply@anamt.org.br logo@2x.png maria@anamt.org.br comercial@anamt.org.br (11) 3251-0849' }],
      anamt,
    )
    expect(r?.email).toBe('comercial@anamt.org.br')
  })

  it('prefere a página do mesmo domínio do evento', () => {
    const r = contatoEmOutraFonte(
      [
        { url: 'https://portal-de-eventos.com.br/anamt', texto: 'Anamt: info@portal.com.br (21) 2222-3333' },
        { url: 'https://congresso2026.anamt.org.br/contato', texto: 'eventos@anamt.org.br (11) 3251-0849' },
      ],
      anamt,
    )
    expect(r?.url).toBe('https://congresso2026.anamt.org.br/contato')
  })
})

describe('extrairEvento com páginas de contato', () => {
  const resumo = JSON.stringify({
    e_evento_futuro: true,
    nome: '23º Congresso Nacional Anamt',
    data_inicio: '2026-11-03',
    cidade: 'Salvador',
  })
  const base = {
    url: 'https://congresso2026.anamt.org.br/',
    resumo,
    textoDaPagina: 'Inscrições abertas.',
    cidadeDoRadar: 'Salvador',
    hoje: '2026-10-25',
  }

  it('sem contato e sem páginas: recusa e marca semContato, com o nome para a busca', () => {
    const r = extrairEvento(base)
    expect(r).toMatchObject({ ok: false, semContato: true, nome: '23º Congresso Nacional Anamt' })
  })

  it('com a página de contato: aceita e registra a fonte do contato', () => {
    const r = extrairEvento({
      ...base,
      paginasDeContato: [{ url: 'https://www.anamt.org.br/eventos', texto: 'Anamt eventos@anamt.org.br (11) 3251-0849' }],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.evento.contato_email).toBe('eventos@anamt.org.br')
    expect(r.evento.fonte_contato_url).toBe('https://www.anamt.org.br/eventos')
    expect(r.evento.contatoDoTexto).toBe(true)
  })

  it('contato na própria página: não usa a externa e a fonte do contato fica nula', () => {
    const r = extrairEvento({
      ...base,
      textoDaPagina: 'Contato: org@anamt.org.br (11) 3000-1000',
      paginasDeContato: [{ url: 'https://www.anamt.org.br/eventos', texto: 'Anamt eventos@anamt.org.br (11) 3251-0849' }],
    })
    expect(r.ok && r.evento.contato_email).toBe('org@anamt.org.br')
    expect(r.ok && r.evento.fonte_contato_url).toBeNull()
  })

  it('evento recusado por outro motivo NÃO é marcado semContato', () => {
    const r = extrairEvento({ ...base, hoje: '2026-12-01' })
    expect(r).toMatchObject({ ok: false, motivo: 'O evento já aconteceu.' })
    expect('semContato' in r && r.semContato).toBeFalsy()
  })
})
