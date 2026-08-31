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

  /**
   * Achado auditando a receita em 30/08: `teste-pro-1787589892727@
   * velofunil.com.br`, criada por script, aparecia como cliente EXTERNO com
   * Pro e entrava na conta de "R$ 490,00/mês".
   *
   * A lista `EMAILS_INTERNOS` cobre quatro endereços fixos e não acompanha
   * conta de teste nova, que nasce com carimbo de tempo no nome — nomear uma a
   * uma nunca daria conta. Ninguém compra o próprio produto pelo e-mail do
   * produto, então o domínio inteiro resolve.
   */
  it('trata o domínio do próprio produto como interno, com nome qualquer', () => {
    expect(ehContaDeTeste('teste-pro-1787589892727@velofunil.com.br')).toBe(true)
    expect(ehContaDeTeste('qualquer.coisa@velofunil.com.br')).toBe(true)
    expect(ehContaDeTeste('SUPORTE@VeloFunil.com.br')).toBe(true)
  })

  // A regra é do domínio EXATO: um domínio que apenas termina com o nosso não
  // é nosso, e tratá-lo como interno esconderia um cliente de verdade.
  it('não confunde domínio parecido com o nosso', () => {
    expect(ehContaDeTeste('alguem@naovelofunil.com.br')).toBe(false)
    expect(ehContaDeTeste('alguem@velofunil.com')).toBe(false)
  })

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

describe('sub-endereçamento (+) não é porta dos fundos', () => {
  /**
   * O caso REAL, medido em 31/08: os testes de ponta a ponta criam conta como
   * `pedroescobar90sb+velofunil-teste-<carimbo>@gmail.com`. O e-mail base está
   * em `EMAILS_DO_DONO` desde sempre, e a comparação exata não casava — 3
   * contas passavam como cliente externo, e os 4 relatos de suporte delas
   * apareciam na fila como se fossem gente de fora.
   */
  it('conta de teste E2E com sufixo cai na lista do dono', () => {
    expect(ehContaDeTeste('pedroescobar90sb+velofunil-teste-1788129871354@gmail.com')).toBe(true)
  })

  it('o e-mail base continua valendo, sem sufixo', () => {
    expect(ehContaDeTeste('pedroescobar90sb@gmail.com')).toBe(true)
  })

  it('vale também para a lista de contas internas', () => {
    expect(ehContaInterna('google.review+qualquer@velofunil.com.br')).toBe(true)
  })

  /**
   * A trava que impede esta correção de virar o regex que o arquivo inteiro
   * proíbe. Normalizar o `+` NÃO classifica ninguém sozinho: só faz a consulta
   * às listas conferidas à mão enxergar a mesma caixa. Cliente de verdade que
   * usa `+` para organizar a própria caixa continua sendo cliente.
   */
  it('cliente real com + continua sendo cliente', () => {
    expect(ehContaDeTeste('joao+velofunil@empresadocliente.com.br')).toBe(false)
    expect(ehContaDeTeste('maria+notas@gmail.com')).toBe(false)
  })

  it('endereço sem @ não quebra', () => {
    expect(ehContaDeTeste('isto-nao-e-email')).toBe(false)
  })
})
