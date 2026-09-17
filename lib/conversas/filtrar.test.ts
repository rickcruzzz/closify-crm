import { describe, expect, it } from 'vitest'

import {
  FILTROS_VAZIOS,
  filtrarConversas,
  temFiltroAtivo,
  type ConversaFiltravel,
} from './filtrar'

const EU = 'user-1'
const OUTRO = 'user-2'

function conversa(over: Partial<ConversaFiltravel> = {}): ConversaFiltravel {
  return {
    nome: 'José Antônio',
    telefone: '+55 (71) 99988-7766',
    previa: 'quanto custa o armário?',
    respondidaEm: null,
    ultimoRecebidoEm: '2026-09-16T12:00:00Z',
    donoId: null,
    ...over,
  }
}

describe('filtrarConversas', () => {
  it('sem filtro nenhum, devolve tudo na MESMA ordem', () => {
    // A ordem é de `ordenarPorEspera`, que é a regra de produto com teste
    // próprio. Um filtro que também reordena seria uma segunda definição de
    // urgência, e duas definições divergem.
    const lista = [conversa({ nome: 'A' }), conversa({ nome: 'B' }), conversa({ nome: 'C' })]
    expect(filtrarConversas(lista, FILTROS_VAZIOS, EU).map((c) => c.nome)).toEqual([
      'A',
      'B',
      'C',
    ])
  })

  it('acha "José" digitando "jose", sem acento e em minúscula', () => {
    // Num país onde metade dos nomes tem acento, quem digita no teclado do
    // celular sem acentuar não acharia ninguém e concluiria que sumiu.
    const r = filtrarConversas([conversa()], { ...FILTROS_VAZIOS, busca: 'jose' }, EU)
    expect(r).toHaveLength(1)
  })

  it('acha pelo que foi DITO, e não só por quem disse', () => {
    // Quem procura uma conversa costuma lembrar do assunto, não do nome.
    const r = filtrarConversas([conversa()], { ...FILTROS_VAZIOS, busca: 'armario' }, EU)
    expect(r).toHaveLength(1)
  })

  it('acha o telefone digitado de qualquer jeito', () => {
    const lista = [conversa()]
    for (const busca of ['71999887766', '99988', '(71) 9998']) {
      expect(filtrarConversas(lista, { ...FILTROS_VAZIOS, busca }, EU)).toHaveLength(1)
    }
  })

  it('busca por LETRA não faz o telefone casar com tudo', () => {
    // O caso que o código precisa tratar: `digitos('ana')` é string vazia, e
    // string vazia está contida em qualquer string. Sem a guarda, buscar "ana"
    // devolveria a lista inteira — resultado plausível e completamente errado.
    const lista = [conversa({ nome: 'José', previa: 'oi' }), conversa({ nome: 'Ana', previa: 'oi' })]
    const r = filtrarConversas(lista, { ...FILTROS_VAZIOS, busca: 'ana' }, EU)
    expect(r).toHaveLength(1)
    expect(r[0]!.nome).toBe('Ana')
  })

  it('quem não casa com nada some', () => {
    expect(
      filtrarConversas([conversa()], { ...FILTROS_VAZIOS, busca: 'geladeira' }, EU),
    ).toHaveLength(0)
  })

  it('"só esperando" usa a MESMA definição que ordena a tela', () => {
    // `respondida_em` nulo é esperando, como na 0056. Ler de outro jeito aqui
    // faria o filtro discordar da ordem da lista.
    const lista = [
      conversa({ nome: 'espera', respondidaEm: null }),
      conversa({ nome: 'respondida', respondidaEm: '2026-09-16T13:00:00Z' }),
    ]
    const r = filtrarConversas(lista, { ...FILTROS_VAZIOS, apenasEsperando: true }, EU)
    expect(r.map((c) => c.nome)).toEqual(['espera'])
  })

  it('conversa em que só NÓS falamos não está esperando ninguém', () => {
    // `respondida_em` nulo sozinho não basta: uma conversa aberta por nós, sem
    // resposta dele, tem os dois campos nulos e apareceria como cliente
    // esperando. O contador da barra lateral já usa esta mesma condição.
    const lista = [conversa({ nome: 'so nos', respondidaEm: null, ultimoRecebidoEm: null })]
    expect(
      filtrarConversas(lista, { ...FILTROS_VAZIOS, apenasEsperando: true }, EU),
    ).toHaveLength(0)
  })

  it('"só minhas" é quem EU assumi, e não quem não tem dono', () => {
    const lista = [
      conversa({ nome: 'minha', donoId: EU }),
      conversa({ nome: 'do outro', donoId: OUTRO }),
      conversa({ nome: 'sem dono', donoId: null }),
    ]
    const r = filtrarConversas(lista, { ...FILTROS_VAZIOS, apenasMinhas: true }, EU)
    expect(r.map((c) => c.nome)).toEqual(['minha'])
  })

  it('os filtros se somam, nunca se substituem', () => {
    const lista = [
      conversa({ nome: 'Ana', donoId: EU, respondidaEm: null }),
      conversa({ nome: 'Ana', donoId: OUTRO, respondidaEm: null }),
      conversa({ nome: 'Ana', donoId: EU, respondidaEm: '2026-09-16T13:00:00Z' }),
      conversa({ nome: 'Bia', donoId: EU, respondidaEm: null }),
    ]
    const r = filtrarConversas(
      lista,
      { busca: 'ana', apenasEsperando: true, apenasMinhas: true },
      EU,
    )
    expect(r).toHaveLength(1)
  })

  it('espaço em branco não conta como busca', () => {
    expect(filtrarConversas([conversa()], { ...FILTROS_VAZIOS, busca: '   ' }, EU)).toHaveLength(
      1,
    )
  })

  it('telefone nulo não quebra a busca por número', () => {
    const r = filtrarConversas(
      [conversa({ telefone: null })],
      { ...FILTROS_VAZIOS, busca: '71999' },
      EU,
    )
    expect(r).toHaveLength(0)
  })
})

describe('temFiltroAtivo', () => {
  it('nada ligado é nada ligado', () => {
    expect(temFiltroAtivo(FILTROS_VAZIOS)).toBe(false)
    expect(temFiltroAtivo({ ...FILTROS_VAZIOS, busca: '  ' })).toBe(false)
  })

  it('qualquer um dos três liga', () => {
    expect(temFiltroAtivo({ ...FILTROS_VAZIOS, busca: 'a' })).toBe(true)
    expect(temFiltroAtivo({ ...FILTROS_VAZIOS, apenasEsperando: true })).toBe(true)
    expect(temFiltroAtivo({ ...FILTROS_VAZIOS, apenasMinhas: true })).toBe(true)
  })
})
