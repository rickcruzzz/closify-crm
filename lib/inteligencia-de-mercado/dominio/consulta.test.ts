import { describe, expect, it } from 'vitest'

import {
  dominioDoEmail,
  montarConsulta,
  normalizarDominio,
  JANELA_DE_BUSCA_MESES,
} from './consulta'

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
      montarConsulta({ nome: 'João', empresa: null, dominio: null }, AGORA),
    ).toBeNull()
    expect(
      montarConsulta({ nome: 'João', empresa: '   ', dominio: '  ' }, AGORA),
    ).toBeNull()
  })

  it('usa NOME e dominio juntos, medido em A/B', () => {
    // Medido contra a API real em 06/09, mesma pergunta em quatro formas:
    // dominio+segmento deu 0 sinais, so dominio 1, so nome 1, e NOME (dominio)
    // deu 2. O nome e como as pessoas escrevem; o dominio desambigua a
    // homonima ("Apice" existe em consultoria, construcao e clinica).
    const c = montarConsulta(
      { nome: 'Ana', empresa: 'Ápice', dominio: 'https://apicelog.com.br' },
      AGORA,
    )!
    expect(c.texto).toContain('Ápice')
    expect(c.texto).toContain('apicelog.com.br')
  })

  it('NUNCA restringe a busca ao site da empresa', () => {
    // Medido contra a API real em 06/09: 6 trechos do site institucional deram
    // ZERO sinais, e a mesma pergunta sem filtro trouxe duas reclamacoes no
    // Reclame Aqui. Ninguem publica a propria dor no proprio site.
    const c = montarConsulta(
      { nome: 'Ana', empresa: 'Ápice', dominio: 'apicelog.com.br' },
      AGORA,
    )!
    expect(c.dominios).toEqual([])
  })

  it('usa o nome quando não há domínio, e não filtra por site', () => {
    const c = montarConsulta(
      { nome: 'Ana', empresa: 'LogiTech Transportes', dominio: null },
      AGORA,
    )!
    expect(c.texto).toContain('LogiTech Transportes')
  })

  it('limita a janela a 12 meses', () => {
    // Dor de dois anos atrás ou já foi resolvida ou não é notícia, e ler o
    // passado custa o mesmo que ler o presente.
    const c = montarConsulta({ nome: 'A', empresa: 'X', dominio: null }, AGORA)!
    expect(c.publicadoDepoisDe).toBe('2025-09-06')
    expect(JANELA_DE_BUSCA_MESES).toBe(12)
  })
})

describe('dominioDoEmail', () => {
  it('tira o dominio da empresa do e-mail corporativo', () => {
    // Em B2B o e-mail corporativo E o dominio da empresa, e essa e a UNICA
    // fonte de dominio que este CRM tem: `leads` nao tem campo de site,
    // conferido no catalogo em 06/09.
    expect(dominioDoEmail('contato@logitechtransp.com.br')).toBe('logitechtransp.com.br')
    expect(dominioDoEmail('  ANA@Apice.COM.BR ')).toBe('apice.com.br')
  })

  it('RECUSA provedor pessoal', () => {
    // Sem esta lista, `joao@gmail.com` viraria uma busca sobre O GMAIL — e o
    // resultado seria plausivel, longo e alheio ao lead. Numero plausivel,
    // conclusao errada: a classe de erro mais cara deste projeto.
    for (const e of [
      'joao@gmail.com', 'maria@hotmail.com', 'x@outlook.com.br',
      'y@yahoo.com.br', 'z@uol.com.br', 'w@icloud.com', 'k@bol.com.br',
    ]) {
      expect(dominioDoEmail(e)).toBeNull()
    }
  })

  it('recusa e-mail malformado sem explodir', () => {
    expect(dominioDoEmail(null)).toBeNull()
    expect(dominioDoEmail('')).toBeNull()
    expect(dominioDoEmail('sem-arroba')).toBeNull()
    expect(dominioDoEmail('a@b@c.com')).toBeNull()
    expect(dominioDoEmail('a@semponto')).toBeNull()
  })
})
