import { describe, expect, it } from 'vitest'

import { negocioSugerido, textoDoCampoDeNegocio } from './negocio-sugerido'

const negocio = (id: string, title = `Negócio ${id}`) => ({ id, title })

describe('negocioSugerido', () => {
  // O caso da esmagadora maioria: um contato, um negócio em andamento. Deixar
  // o campo vazio aqui empurra para a pessoa uma decisão de resposta única.
  it('com um negócio aberto, já vem escolhido', () => {
    expect(negocioSugerido([negocio('a')])).toBe('a')
  })

  /**
   * Escolher pela pessoa aqui erra CALADO: a tarefa apareceria no negócio
   * errado e o certo continuaria dizendo "Nenhuma agendada" — o defeito de
   * origem com outra roupa.
   */
  it('com dois ou mais, não escolhe por ninguém', () => {
    expect(negocioSugerido([negocio('a'), negocio('b')])).toBeNull()
    expect(negocioSugerido([negocio('a'), negocio('b'), negocio('c')])).toBeNull()
  })

  // Tarefa só do contato é uso legítimo: o check `tasks_alvo_minimo` (0029)
  // exige lead OU negócio, não os dois.
  it('sem negócio aberto, não há o que ligar', () => {
    expect(negocioSugerido([])).toBeNull()
  })
})

describe('textoDoCampoDeNegocio', () => {
  it('sem negócio, o campo não tem por que aparecer', () => {
    expect(textoDoCampoDeNegocio([])).toBeNull()
  })

  // Valor que aparece do nada gera desconfiança: a frase precisa dizer o que
  // ele vai fazer.
  it('com um, avisa o que já foi preenchido', () => {
    expect(textoDoCampoDeNegocio([negocio('a')])).toBe(
      'A tarefa aparece como próxima ação deste negócio.',
    )
  })

  it('com vários, a frase pede a escolha em vez de afirmar', () => {
    const texto = textoDoCampoDeNegocio([negocio('a'), negocio('b')])
    expect(texto).toBe('Escolha em qual negócio esta tarefa aparece como próxima ação.')
  })

  // As duas frases não podem ser a mesma: uma informa, a outra pede ação.
  it('as frases dos dois casos são diferentes', () => {
    expect(textoDoCampoDeNegocio([negocio('a')])).not.toBe(
      textoDoCampoDeNegocio([negocio('a'), negocio('b')]),
    )
  })
})
