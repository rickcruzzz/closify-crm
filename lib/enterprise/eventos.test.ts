import { describe, expect, it } from 'vitest'
import { avaliarEvento } from './eventos'

describe('prioridade de eventos', () => {
  const agora = new Date('2026-10-21T15:00:00Z')

  it('explica cada sinal usado sem afirmar chance de fechamento', () => {
    const resultado = avaliarEvento({
      nome: 'Feira de negócios',
      data_inicio: '2026-11-20',
      cidade: 'Salvador',
      fonte_url: 'https://exemplo.com/feira',
      organizador: 'Associação comercial',
      contato_email: 'contato@exemplo.com',
      publico_estimado: 2000,
    }, agora)
    expect(resultado.prioridade).toBe(100)
    expect(resultado.justificativa).toContain('Organizador identificado')
    expect(resultado.justificativa).toContain('Canal direto')
    expect(resultado.justificativa).not.toMatch(/chance|fechamento/i)
  })

  it('não prioriza como futuro um evento passado sem contato', () => {
    const resultado = avaliarEvento({
      nome: 'Simpósio antigo',
      data_inicio: '2026-09-01',
      cidade: 'Salvador',
      fonte_url: 'https://exemplo.com/simposio',
    }, agora)
    expect(resultado.prioridade).toBe(20)
    expect(resultado.justificativa).toContain('já passou')
    expect(resultado.justificativa).toContain('falta confirmar')
  })
})
