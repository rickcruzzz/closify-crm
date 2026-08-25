import { describe, expect, it } from 'vitest'

import { ehContaDeTeste, ehContaInterna } from './contas-internas'

/**
 * O defeito que motivou esta função, medido em 20/08: com a conta de revisão
 * do Google recebendo Pro de cortesia, a Central passou a dizer R$ 98/mês
 * quando a receita real era R$ 49. Painel de dinheiro que conta dinheiro que
 * ninguém pagou é pior que painel nenhum.
 */
describe('ehContaInterna', () => {
  it('reconhece a conta de revisão do Google', () => {
    expect(ehContaInterna('google.review@velofunil.com.br')).toBe(true)
  })

  it('não diferencia maiúscula nem espaço nas pontas', () => {
    expect(ehContaInterna('  Google.Review@VeloFunil.com.br ')).toBe(true)
  })

  // O risco real é o oposto do óbvio: marcar cliente de verdade como interno
  // esconderia receita e faria o dono achar que vende menos do que vende.
  it('não marca cliente de verdade como interno', () => {
    for (const email of [
      'fanimayara67@gmail.com',
      'testei122@gmaa2il.com',
      'contato@velofunil.com.br',
      'suporte@velofunil.com.br',
    ]) {
      expect(ehContaInterna(email)).toBe(false)
    }
  })

  it('aguenta ausência de e-mail', () => {
    expect(ehContaInterna(null)).toBe(false)
    expect(ehContaInterna(undefined)).toBe(false)
    expect(ehContaInterna('')).toBe(false)
  })
})

describe('ehContaDeTeste', () => {
  it('trata e-mail ausente como teste, não como cliente', () => {
    // Sem e-mail não dá para AFIRMAR que é cliente real, e o erro barato é
    // esconder uma conta órfã do painel; o caro é mandar o dono perseguir uma.
    expect(ehContaDeTeste(null)).toBe(true)
    expect(ehContaDeTeste('')).toBe(true)
  })

  it('pega domínio descartável dos scripts deste projeto', () => {
    expect(ehContaDeTeste('bevoj72963@ehwit.com')).toBe(true)
    expect(ehContaDeTeste('lovore5972@prodbits.com')).toBe(true)
  })

  it('pega conta do próprio dono, inclusive em gmail', () => {
    // Filtro por domínio sozinho não pegaria: é gmail comum, como o de
    // qualquer cliente. Por isso a lista de e-mails existe ao lado.
    expect(ehContaDeTeste('j4693001@gmail.com')).toBe(true)
    expect(ehContaDeTeste('  J4693001@Gmail.com  ')).toBe(true)
  })

  it('NÃO classifica como teste quem só parece', () => {
    // O caso concreto que este projeto quase apagou: `testei122@gmaa2il.com`
    // casa com qualquer regex de "parece teste" e é cliente de verdade, dona
    // de empresa com contatos e negócios. Lista fechada nunca erra assim.
    expect(ehContaDeTeste('testei122@gmaa2il.com')).toBe(false)
    expect(ehContaDeTeste('contato@clinicaboavista.com.br')).toBe(false)
  })

  it('conta interna continua sendo teste para as duas telas', () => {
    expect(ehContaDeTeste('google.review@velofunil.com.br')).toBe(true)
  })
})
