import { describe, expect, it } from 'vitest'

import {
  CICLOS,
  PRO_ANUAL_ECONOMIA,
  PRO_ANUAL_MESES,
  PRO_ANUAL_MESES_COBRADOS,
  PRO_ANUAL_MESES_GRATIS,
  PRO_ANUAL_PRICE,
  PRO_PLAN_PRICE,
  valorDoCiclo,
} from '@/lib/plans'
import type { CicloDeCobranca } from '@/lib/plans'
import type { CicloDeCobranca as CicloNoBanco } from '@/types/supabase'

/**
 * O que estes casos protegem é a OFERTA, não o número.
 *
 * `tsc` garante que as contas compilam. Nada garante que elas continuem
 * dizendo a verdade no dia em que alguém editar um valor e não o outro — e a
 * frase "dois meses grátis" seguiria na tela, vendida ao cliente, errada.
 */
describe('plano anual', () => {
  // O caso mais importante do arquivo: um "desconto" que não desconta é a
  // única forma de este plano se tornar uma mentira publicada.
  it('é mais barato que pagar mês a mês', () => {
    expect(PRO_ANUAL_PRICE).toBeLessThan(PRO_PLAN_PRICE * PRO_ANUAL_MESES)
  })

  it('cobra dez meses e entrega doze', () => {
    expect(PRO_ANUAL_MESES_COBRADOS).toBeLessThan(PRO_ANUAL_MESES)
    expect(PRO_ANUAL_PRICE).toBe(PRO_PLAN_PRICE * PRO_ANUAL_MESES_COBRADOS)
  })

  // A frase da peça de venda, conferida por aritmética em vez de por leitura.
  it('os meses grátis batem com a economia anunciada', () => {
    expect(PRO_ANUAL_MESES_GRATIS).toBe(PRO_ANUAL_MESES - PRO_ANUAL_MESES_COBRADOS)
    expect(PRO_ANUAL_ECONOMIA).toBe(PRO_PLAN_PRICE * PRO_ANUAL_MESES_GRATIS)
    expect(PRO_ANUAL_PRICE + PRO_ANUAL_ECONOMIA).toBe(PRO_PLAN_PRICE * PRO_ANUAL_MESES)
  })

  /**
   * ## As chaves são contrato com o gateway, não nomenclatura interna
   *
   * Elas vão cruas no `POST /subscriptions` e voltam cruas em
   * `GET /subscriptions/{id}.cycle`. Renomear para `mensal`/`anual` pareceria
   * coerência com o resto do projeto e quebraria a igualdade de string que a
   * reconciliação usa — em silêncio, porque o `tsc` aceitaria os dois lados.
   */
  it('as chaves são exatamente o vocabulário do Asaas', () => {
    expect(Object.keys(CICLOS).sort()).toEqual(['MONTHLY', 'YEARLY'])
  })

  it('o valor do ciclo é o preço do plano correspondente', () => {
    expect(valorDoCiclo('MONTHLY')).toBe(PRO_PLAN_PRICE)
    expect(valorDoCiclo('YEARLY')).toBe(PRO_ANUAL_PRICE)
  })

  // O mensal é o lado seguro de errar: uma cobrança de R$ 49 indevida se
  // resolve com um estorno, uma de R$ 490 vira caso de suporte.
  it('o ciclo mais barato é o mensal', () => {
    expect(valorDoCiclo('MONTHLY')).toBeLessThan(valorDoCiclo('YEARLY'))
  })
})

/**
 * ## A trava que o `tsc` faz, e nenhum caso de teste faria
 *
 * `CicloDeCobranca` existe em dois lugares de propósito: `types/supabase.ts`
 * descreve o `check` do banco (e aquele arquivo não importa nada, por
 * convenção), e `lib/plans.ts` deriva das chaves de `CICLOS`, que é o que o
 * produto de fato oferece.
 *
 * Duas definições divergem em silêncio — a armadilha registrada em 29/08. Esta
 * igualdade estrutural **para de compilar** no instante em que uma das duas
 * ganhar ou perder um valor. Não roda em tempo de execução: o trabalho é do
 * `npx tsc --noEmit`, e é lá que a falha aparece.
 */
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

const _osCiclosBatemComOBanco: Igual<CicloDeCobranca, CicloNoBanco> = true
void _osCiclosBatemComOBanco
