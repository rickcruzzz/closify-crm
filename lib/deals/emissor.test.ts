import { describe, expect, it } from 'vitest'

import { nomeDoEmissor, podeEmitirOrcamento, temComoResponder } from './emissor'

describe('podeEmitirOrcamento', () => {
  it('empresa SEM nenhum dado nao emite', () => {
    // O caso medido: 49 dos 51 workspaces em producao, nove deles em Pro. O
    // PDF saia assinado pelo nome do workspace e sem nenhuma forma de contato.
    expect(podeEmitirOrcamento({}).pode).toBe(false)
    expect(podeEmitirOrcamento(null).pode).toBe(false)
    expect(podeEmitirOrcamento(undefined).pode).toBe(false)
  })

  it('so o NOME nao basta: o documento tem que ser respondivel', () => {
    // Um orcamento de R$ 7.400 assinado por "Marcenaria Silva" e mais nada
    // deixa o cliente do cliente sem nenhum caminho de volta.
    expect(podeEmitirOrcamento({ nome_fantasia: 'Marcenaria Silva' }).pode).toBe(false)
  })

  it('so o CONTATO nao basta: falta saber quem assina', () => {
    expect(podeEmitirOrcamento({ whatsapp: '71999887766' }).pode).toBe(false)
  })

  it('nome mais UMA forma de contato emite, e CNPJ nao e exigido', () => {
    // Autonomo sem CNPJ emite orcamento todo dia, e e parte legitima do
    // publico: a regua de nichos de 07/09 mediu marcenaria, dedetizadora e
    // comunicacao visual, onde o MEI e o informal sao a norma.
    const r = podeEmitirOrcamento({
      nome_fantasia: 'Marcenaria Silva',
      whatsapp: '71999887766',
    })
    expect(r.pode).toBe(true)
    expect(r.pode && r.nome).toBe('Marcenaria Silva')
  })

  it('QUALQUER um dos cinco canais serve', () => {
    const base = { nome_fantasia: 'Marcenaria Silva' }
    for (const canal of [
      { telefone: '7133334444' },
      { whatsapp: '71999887766' },
      { email_comercial: 'contato@marcenaria.com.br' },
      { site: 'https://marcenaria.com.br' },
      { cnpj: '68877105000167' },
    ]) {
      expect(podeEmitirOrcamento({ ...base, ...canal }).pode).toBe(true)
    }
  })

  it('espaco em branco NAO conta como dado preenchido', () => {
    // Campo com espaco passa por qualquer checagem de "falsy" e produz
    // exatamente o documento anonimo que a guarda existe para impedir.
    expect(
      podeEmitirOrcamento({ nome_fantasia: '   ', whatsapp: '71999887766' }).pode,
    ).toBe(false)
    expect(
      podeEmitirOrcamento({ nome_fantasia: 'Marcenaria', whatsapp: '  ' }).pode,
    ).toBe(false)
  })

  it('a recusa carrega a FRASE, e nao um booleano solto', () => {
    // Duplicar a mensagem na rota e como duas mensagens divergem.
    const r = podeEmitirOrcamento({})
    expect(r.pode).toBe(false)
    expect(r.pode === false && r.motivo).toMatch(/quem está cobrando/)
  })
})

describe('nomeDoEmissor', () => {
  it('nome_fantasia vence o name do workspace', () => {
    // `workspaces.name` e como a pessoa chamou a empresa DENTRO do produto e
    // pode ser um apelido; o fantasia e o que o cliente dela reconhece.
    expect(
      nomeDoEmissor({ name: 'Minha empresa', nome_fantasia: 'Marcenaria Silva' }),
    ).toBe('Marcenaria Silva')
  })

  it('cai no name quando nao ha fantasia', () => {
    expect(nomeDoEmissor({ name: 'Marcenaria Silva' })).toBe('Marcenaria Silva')
  })

  it('NAO inventa nome', () => {
    // A versao anterior caia em `|| 'Orçamento'`, e o documento saia com um
    // emissor chamado literalmente "Orçamento".
    expect(nomeDoEmissor({})).toBe('')
    expect(nomeDoEmissor({ name: '  ' })).toBe('')
  })
})

describe('temComoResponder', () => {
  it('cinco canais, qualquer um serve', () => {
    expect(temComoResponder({ site: 'https://x.com.br' })).toBe(true)
    expect(temComoResponder({})).toBe(false)
  })
})
