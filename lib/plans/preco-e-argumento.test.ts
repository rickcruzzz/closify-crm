import { describe, expect, it } from 'vitest'

import {
  PESSOAS_PARA_COMPENSAR,
  PRECO_MEDIANA_POR_USUARIO,
  PRO_PLAN_PRICE,
} from '@/lib/plans'

/**
 * ## O argumento de preço tem que continuar verdadeiro quando o preço muda
 *
 * Duas afirmações da landing viraram falsas na troca de R$ 49 para R$ 97 sem
 * ninguém tocar em uma linha de código:
 *
 *     "Menos de R$ 2 por dia"        R$ 97/30 = R$ 3,23
 *     a tabela de comparacao         abria mostrando R$ 60 contra R$ 97,
 *                                    ou seja, o concorrente ganhando
 *
 * As duas são aritmética sobre uma constante, e é por isso que dá para travar.
 */
describe('o ponto de virada é derivado, nunca escrito à mão', () => {
  it('é o primeiro tamanho de equipe em que o fixo ganha', () => {
    expect(PRECO_MEDIANA_POR_USUARIO * PESSOAS_PARA_COMPENSAR).toBeGreaterThanOrEqual(
      PRO_PLAN_PRICE,
    )
  })

  /**
   * O caso que dá sentido ao número: com uma pessoa a MENOS que o ponto de
   * virada, o concorrente tem que sair mais barato. Sem isto,
   * `PESSOAS_PARA_COMPENSAR = 1` passaria no caso acima e a legenda diria "a
   * partir de 1 pessoa" enquanto a tabela mostra o contrário.
   */
  it('um degrau abaixo, o concorrente é mais barato', () => {
    if (PESSOAS_PARA_COMPENSAR <= 1) return
    expect(PRECO_MEDIANA_POR_USUARIO * (PESSOAS_PARA_COMPENSAR - 1)).toBeLessThan(PRO_PLAN_PRICE)
  })

  /**
   * A tabela da landing abre em 1 pessoa. Se o ponto de virada passar de 4, a
   * primeira linha em que ganhamos sai da tabela inteira — e ela vira quatro
   * linhas de derrota. Aí o argumento precisa mudar, não o número.
   */
  it('o ponto de virada cabe na tabela, que vai até 10 pessoas', () => {
    expect(PESSOAS_PARA_COMPENSAR).toBeLessThanOrEqual(4)
  })
})
