import { describe, expect, it } from 'vitest'

import { chaveDaPagina, extrairEvento, lerResumo, primeiroEmail, primeiroTelefone } from './extracao'

const base = {
  url: 'https://bahiatechexperience.com.br/',
  textoDaPagina: null,
  cidadeDoRadar: 'Salvador',
  hoje: '2026-10-22',
}

// O formato REAL que a Exa devolveu em 22/10 para o BTX 26: string de JSON,
// com os campos de contato nulos.
const resumoDoBtx = JSON.stringify({
  cidade: 'Salvador',
  contato_email: null,
  contato_nome: null,
  contato_telefone: null,
  data_inicio: '2026-12-05',
  e_evento_futuro: true,
  nome: 'BTX 26 | Bahia Tech Experience',
  organizador: null,
  perfil_publico: null,
  publico_estimado: null,
})

describe('extrairEvento', () => {
  it('aceita o resumo real da Exa, que chega como string de JSON', () => {
    const r = extrairEvento({ ...base, resumo: resumoDoBtx })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.evento.nome).toBe('BTX 26 | Bahia Tech Experience')
    expect(r.evento.data_inicio).toBe('2026-12-05')
    expect(r.evento.contato_email).toBeNull()
  })

  it('busca o contato no TEXTO da página quando o resumo não traz (o caso do BTX)', () => {
    const r = extrairEvento({
      ...base,
      resumo: resumoDoBtx,
      textoDaPagina: 'Fale conosco: comercial@btx.com.br ou (71) 99999-1234. logo@2x.png',
    })
    expect(r.ok && r.evento.contato_email).toBe('comercial@btx.com.br')
    expect(r.ok && r.evento.contato_telefone).toBe('5571999991234')
    expect(r.ok && r.evento.contatoDoTexto).toBe(true)
  })

  it('normaliza a cidade escrita pela página para a do radar', () => {
    const resumo = JSON.stringify({ ...JSON.parse(resumoDoBtx), cidade: 'Salvador - BA' })
    const r = extrairEvento({ ...base, resumo })
    expect(r.ok && r.evento.cidade).toBe('Salvador')
  })

  it('cidade ausente no resumo: aceita quando a página escreve a cidade do radar', () => {
    const resumo = JSON.stringify({ ...JSON.parse(resumoDoBtx), cidade: null })
    expect(extrairEvento({ ...base, resumo, textoDaPagina: 'Centro de Convenções de Salvador' }).ok).toBe(true)
    expect(extrairEvento({ ...base, resumo, textoDaPagina: 'Recife, PE' }).ok).toBe(false)
  })

  it('recusa evento de outra cidade, com o motivo', () => {
    const resumo = JSON.stringify({ ...JSON.parse(resumoDoBtx), cidade: 'Recife' })
    expect(extrairEvento({ ...base, resumo })).toEqual({ ok: false, motivo: 'O evento não é em Salvador.' })
  })

  it('recusa evento que já passou, mesmo se o modelo disser que é futuro', () => {
    const resumo = JSON.stringify({ ...JSON.parse(resumoDoBtx), data_inicio: '2026-01-10' })
    expect(extrairEvento({ ...base, resumo })).toEqual({ ok: false, motivo: 'O evento já aconteceu.' })
  })

  it('recusa data em formato que não é AAAA-MM-DD', () => {
    const resumo = JSON.stringify({ ...JSON.parse(resumoDoBtx), data_inicio: '05/12/2026' })
    expect(extrairEvento({ ...base, resumo }).ok).toBe(false)
  })

  it('recusa página que não é um evento futuro específico', () => {
    const resumo = JSON.stringify({ ...JSON.parse(resumoDoBtx), e_evento_futuro: false })
    expect(extrairEvento({ ...base, resumo }).ok).toBe(false)
  })

  it('recusa resumo quebrado sem lançar', () => {
    expect(extrairEvento({ ...base, resumo: '{nao e json' })).toEqual({
      ok: false,
      motivo: 'A página não pôde ser lida.',
    })
  })

  it('descarta público que não é inteiro positivo', () => {
    const resumo = JSON.stringify({ ...JSON.parse(resumoDoBtx), publico_estimado: -5 })
    const r = extrairEvento({ ...base, resumo })
    expect(r.ok && r.evento.publico_estimado).toBeNull()
  })
})

describe('contato escrito na página', () => {
  it('pula nome de arquivo que parece e-mail', () => {
    expect(primeiroEmail('logo@2x.png contato@evento.com')).toBe('contato@evento.com')
  })

  it('ignora telefone estrangeiro e pega o primeiro brasileiro', () => {
    expect(primeiroTelefone('+1 415 555 2671 e também 71 3333-4444')).toBe('557133334444')
  })

  it('devolve nulo quando não há contato', () => {
    expect(primeiroEmail('sem contato')).toBeNull()
    expect(primeiroTelefone(null)).toBeNull()
  })
})

describe('lerResumo', () => {
  it('aceita objeto ou string, e nulo no resto', () => {
    expect(lerResumo({ a: 1 })).toEqual({ a: 1 })
    expect(lerResumo('{"a":1}')).toEqual({ a: 1 })
    expect(lerResumo(42)).toBeNull()
  })
})

describe('chaveDaPagina', () => {
  it('trata com e sem www e barra final como a mesma página', () => {
    expect(chaveDaPagina('https://www.evento.com.br/')).toBe(chaveDaPagina('https://evento.com.br'))
  })
})
