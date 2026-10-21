import { describe, expect, it } from 'vitest'

import { empresasPermitidas, podeUsarEvolution } from '@/lib/whatsapp/evolution-permitida'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

/**
 * Quem pode ser atendido pela VPS da Evolution, que fica em Boston.
 *
 * O porquê inteiro está em `evolution-permitida.ts`: a landing promete que nada
 * de cliente atravessa fronteira para ser processado, e esta lista é a única
 * coisa que faz essa frase continuar verdadeira enquanto o transporte existe.
 */
describe('a lista fecha por padrão', () => {
  /**
   * O CASO QUE MOTIVOU O TESTE, e o único cujo erro é caro.
   *
   * Uma lista que virasse "todo mundo" quando a variável falta abriria a
   * Evolution para qualquer empresa com Max no primeiro deploy em que alguém
   * esquecesse de configurá-la. O sintoma seria ZERO: a conexão funcionaria, o
   * cliente pareia o número, e o dado passa a ser processado fora do país
   * contra o que a página de vendas afirma.
   */
  it('variável ausente não autoriza NINGUÉM', () => {
    expect(podeUsarEvolution(A, undefined)).toBe(false)
    expect(empresasPermitidas(undefined).size).toBe(0)
  })

  it('variável vazia também não autoriza ninguém', () => {
    expect(podeUsarEvolution(A, '')).toBe(false)
    expect(podeUsarEvolution(A, '   ')).toBe(false)
  })

  it('quem está na lista passa, e quem não está NÃO', () => {
    const lista = `${A},${B}`
    expect(podeUsarEvolution(A, lista)).toBe(true)
    expect(podeUsarEvolution(B, lista)).toBe(true)
    // O controle: sem ele, "a lista autoriza" e "a lista autoriza todo mundo"
    // dariam o mesmo resultado nos dois casos acima.
    expect(podeUsarEvolution(C, lista)).toBe(false)
  })

  it('aceita espaço, quebra de linha e caixa, que é como se cola do painel', () => {
    expect(podeUsarEvolution(A, ` ${A.toUpperCase()} \n ${B} `)).toBe(true)
    expect(podeUsarEvolution(A.toUpperCase(), A)).toBe(true)
  })

  /**
   * Id torto é descartado em vez de guardado. Guardá-lo encheria a lista de
   * coisa que nunca casa com um `workspace_id`, e uma lista com três entradas
   * autorizando uma empresa leria como defeito.
   */
  it('descarta o que não é UUID', () => {
    expect(empresasPermitidas(`${A},lixo,,"${B}"`)).toEqual(new Set([A]))
    expect(empresasPermitidas('todos').size).toBe(0)
    expect(empresasPermitidas('*').size).toBe(0)
  })

  /**
   * `*` merece caso próprio: é o curinga que alguém escreveria por reflexo
   * esperando "libere tudo", e aqui ele tem que NÃO liberar nada.
   */
  it('curinga não é atalho para todo mundo', () => {
    expect(podeUsarEvolution(A, '*')).toBe(false)
    expect(podeUsarEvolution(A, 'all')).toBe(false)
  })
})
