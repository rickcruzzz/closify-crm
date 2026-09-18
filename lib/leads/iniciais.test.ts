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

/**
 * Achado abrindo `/conversas` em producao com dado real, em 18/09.
 *
 * O avatar mostrava dois losangos de caractere invalido, e o console da pagina
 * carregava React #425 e #422. Era a MESMA causa: `parte[0]` devolvia metade
 * de um par substituto, e substituto solto nao serializa igual no HTML do
 * servidor e no render do navegador, entao a hidratacao da tela INTEIRA caia.
 *
 * Isto e a caixa do WhatsApp. Nome com emoji nao e caso raro aqui.
 */
describe('nome fora do plano basico', () => {
  it('fonte estilizada devolve a LETRA, e nao meio par substituto', () => {
    const r = iniciais('\u{1D5B5}\u{1D5BE}\u{1D5C5}\u{1D5C8} \u{1D5A5}\u{1D5CE}\u{1D5C7}\u{1D5C2}\u{1D5C5}')
    expect(r).toBe('\u{1D5B5}\u{1D5A5}')
  })

  /**
   * O controle que separa "consertei" de "troquei um caractere quebrado por
   * outro": nenhum code point do resultado pode ser substituto solto.
   */
  it('nenhum resultado carrega substituto solto', () => {
    for (const nome of ['\u{1F984} Unicornio', 'Ana \u{1F600}', '\u{1D5B5}\u{1D5BE}\u{1D5C5}\u{1D5C8}']) {
      for (const ch of Array.from(iniciais(nome))) {
        const c = ch.codePointAt(0)!
        expect(c >= 0xd800 && c <= 0xdfff).toBe(false)
      }
    }
  })

  it('emoji sozinho vira a propria inicial', () => {
    expect(iniciais('\u{1F984} Unicornio')).toBe('\u{1F984}U')
  })

  /** O caminho comum nao muda, e e o que garante que nada regrediu. */
  it('nome normal continua igual', () => {
    expect(iniciais('Maria da Silva')).toBe('MS')
  })
})
