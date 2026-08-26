import { describe, expect, it } from 'vitest'

import { iniciais } from './iniciais'

describe('iniciais', () => {
  it('nome simples devolve as duas letras', () => {
    expect(iniciais('Marcia Souza')).toBe('MS')
  })

  /**
   * O defeito que as três cópias antigas do Kanban tinham.
   *
   * Elas pegavam as duas PRIMEIRAS palavras, então "Maria da Silva" virava
   * "MD" — a inicial de uma preposição, que ninguém escreveria.
   */
  it('preposição não vira inicial', () => {
    expect(iniciais('Maria da Silva')).toBe('MS')
    expect(iniciais('João de Souza Lima')).toBe('JL')
    expect(iniciais('Ana dos Santos')).toBe('AS')
  })

  // "Maria Fernanda Souza" é reconhecida por MS, não por MF: o sobrenome
  // identifica mais que o segundo nome.
  it('usa a primeira e a ÚLTIMA palavra, não as duas primeiras', () => {
    expect(iniciais('Maria Fernanda Souza')).toBe('MS')
    expect(iniciais('Orlando Henrique Bastos da Cruz')).toBe('OC')
  })

  it('um nome só devolve uma letra', () => {
    expect(iniciais('Renata')).toBe('R')
  })

  // Nome de empresa entra aqui igual: o contato do WhatsApp pode ser
  // "Auto Peças Bahia", e o avatar precisa de algo legível.
  it('funciona com nome de empresa', () => {
    expect(iniciais('Auto Peças Bahia')).toBe('AB')
    expect(iniciais('Clinica Vida Nova')).toBe('CN')
  })

  // Contato do WhatsApp pode chegar sem nome nenhum: o webhook usa
  // "WhatsApp <4 últimos dígitos>" nesse caso, mas o campo aceita nulo.
  it('vazio, nulo ou só espaço devolve interrogação, nunca string vazia', () => {
    expect(iniciais('')).toBe('?')
    expect(iniciais(null)).toBe('?')
    expect(iniciais(undefined)).toBe('?')
    expect(iniciais('   ')).toBe('?')
  })

  // Nome composto SÓ de preposição não existe na prática, mas string vazia no
  // avatar deixaria um círculo mudo em vez de um marcador.
  it('nome que vira nada depois do filtro ainda devolve algo', () => {
    expect(iniciais('de da do')).toBe('?')
  })

  it('não quebra com espaço a mais no meio', () => {
    expect(iniciais('  Marcia    Souza  ')).toBe('MS')
  })
})
