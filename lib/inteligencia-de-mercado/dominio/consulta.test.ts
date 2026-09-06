import { describe, expect, it } from 'vitest'

import { montarConsulta, normalizarDominio, JANELA_DE_BUSCA_MESES } from './consulta'

const AGORA = new Date('2026-09-06T12:00:00Z')

describe('normalizarDominio', () => {
  it('tira protocolo, www, caminho, porta e query', () => {
    // O CRM aceita o que a pessoa digitou, e ela digita de tudo. O filtro de
    // domínio do Exa só casa com o host puro — com qualquer sobra a busca volta
    // vazia SEM erro, que é o pior tipo de falha.
    for (const bruto of [
      'https://www.site.com.br/contato?x=1',
      'HTTP://SITE.COM.BR',
      '  site.com.br  ',
      'site.com.br:443/#topo',
    ]) {
      expect(normalizarDominio(bruto)).toBe('site.com.br')
    }
  })

  it('recusa o que não é domínio', () => {
    // "minha empresa" como filtro de domínio zera a busca em silêncio.
    expect(normalizarDominio('minha empresa')).toBeNull()
    expect(normalizarDominio('semponto')).toBeNull()
    expect(normalizarDominio('')).toBeNull()
    expect(normalizarDominio(null)).toBeNull()
  })
})

describe('montarConsulta', () => {
  it('devolve null quando não há empresa nem domínio', () => {
    // Consulta fraca é pior que nenhuma: gasta crédito e devolve ruído que o
    // extrator vai tentar transformar em dor.
    expect(
      montarConsulta({ nome: 'João', empresa: null, dominio: null, segmento: null }, AGORA),
    ).toBeNull()
    expect(
      montarConsulta({ nome: 'João', empresa: '   ', dominio: '  ', segmento: null }, AGORA),
    ).toBeNull()
  })

  it('prefere o DOMÍNIO ao nome da empresa', () => {
    // Nome de empresa é ambíguo: "Ápice" existe em consultoria, construção e
    // clínica. Buscar por nome traz a homônima e produz um insight plausível
    // sobre a empresa ERRADA.
    const c = montarConsulta(
      { nome: 'Ana', empresa: 'Ápice', dominio: 'https://apicelog.com.br', segmento: null },
      AGORA,
    )!
    expect(c.texto).toContain('apicelog.com.br')
    expect(c.texto).not.toContain('Ápice')
  })

  it('NUNCA restringe a busca ao site da empresa', () => {
    // Medido contra a API real em 06/09: 6 trechos do site institucional deram
    // ZERO sinais, e a mesma pergunta sem filtro trouxe duas reclamacoes no
    // Reclame Aqui. Ninguem publica a propria dor no proprio site.
    const c = montarConsulta(
      { nome: 'Ana', empresa: 'Ápice', dominio: 'apicelog.com.br', segmento: null },
      AGORA,
    )!
    expect(c.dominios).toEqual([])
  })

  it('usa o nome quando não há domínio, e não filtra por site', () => {
    const c = montarConsulta(
      { nome: 'Ana', empresa: 'LogiTech Transportes', dominio: null, segmento: 'Logística' },
      AGORA,
    )!
    expect(c.texto).toContain('LogiTech Transportes')
    expect(c.texto).toContain('Logística')
  })

  it('limita a janela a 12 meses', () => {
    // Dor de dois anos atrás ou já foi resolvida ou não é notícia, e ler o
    // passado custa o mesmo que ler o presente.
    const c = montarConsulta({ nome: 'A', empresa: 'X', dominio: null, segmento: null }, AGORA)!
    expect(c.publicadoDepoisDe).toBe('2025-09-06')
    expect(JANELA_DE_BUSCA_MESES).toBe(12)
  })
})
