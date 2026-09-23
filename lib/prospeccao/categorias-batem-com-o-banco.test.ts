import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ESTAGIOS, INTENCOES, OBJECOES, TEMPERATURAS } from '@/lib/prospeccao/classificacao'

/**
 * As quatro listas fechadas existem em DOIS lugares, e este teste é o que
 * impede que elas discordem.
 *
 * ## O que acontece quando discordam, e é silencioso
 *
 * `lib/prospeccao/classificacao.ts` declara as categorias em TypeScript; a
 * migration 0086 as declara de novo, como `check` no banco. Categoria nova só
 * no TypeScript compila, passa no `tsc`, monta o prompt, o modelo responde com
 * ela — e o `insert` toma `23514`. A classificação some, e a fila encolhe sem
 * explicação.
 *
 * `lib/prospeccao/classificar.ts:70-75` já reconhecia o risco, em texto:
 * *"escrever as categorias à mão aqui seria a segunda cópia que diverge"*. Ele
 * resolveu a TERCEIRA cópia, o prompt, derivando-a destas constantes. As duas
 * primeiras continuaram sem nada travando, e nenhum dos onze testes que leem
 * migrations cobria este par.
 *
 * ## Por que ler o SQL, e não repetir a lista aqui
 *
 * Repetir seria a quarta cópia. O `check` do banco é a última porta — é ele
 * que decide o que entra — então é ele que este teste lê.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

/**
 * Os valores de um `check (coluna in (...))`, da ÚLTIMA migration que define
 * aquela coluna.
 *
 * Ler todas e unir daria a união histórica, que é maior que o que o banco
 * aceita hoje — e o teste passaria justamente no caso de alguém ter APERTADO
 * o check sem apertar o TypeScript.
 */
function valoresDoCheck(coluna: string): string[] {
  const arquivos = readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith('.sql'))
    .sort()

  let encontrado: string[] | null = null
  for (const nome of arquivos) {
    const sql = readFileSync(join(MIGRATIONS, nome), 'utf-8')
    // Aceita `x in (` e `x is null or x in (`, que é como a coluna opcional
    // é escrita na 0086.
    const re = new RegExp(
      String.raw`check\s*\(\s*${coluna}\s*(?:is null or\s*${coluna}\s*)?in\s*\(([^)]*)\)`,
      'i',
    )
    const achado = sql.match(re)
    if (achado) {
      encontrado = Array.from(achado[1].matchAll(/'([^']+)'/g))
        .map((m) => m[1])
        .sort()
    }
  }
  return encontrado ?? []
}

const PARES = [
  ['intencao', INTENCOES],
  ['objecao', OBJECOES],
  ['temperatura', TEMPERATURAS],
  ['estagio', ESTAGIOS],
] as const

/**
 * Os valores que o BANCO aceita e o TypeScript nunca produz.
 *
 * Os dois sentidos da divergência têm gravidades opostas, e foi o próprio
 * teste que ensinou isso na primeira execução:
 *
 *     TS tem e o banco não    o `insert` toma 23514 e a classificação SOME
 *     banco tem e o TS não    nada escreve aquele valor. Schema morto
 *
 * O primeiro é falha dura. O segundo é uma pendência, e ela fica listada aqui
 * com o motivo: acrescentar um valor novo ao `check` sem ligá-lo no código
 * reprova, mas os já conhecidos não travam o portão.
 *
 * `RESPOSTA_AUTOMATICA` entrou no banco pela 0087, que nasceu porque as 47
 * primeiras mensagens do disparo real produziram 18 "respostas" e NENHUMA era
 * pessoa. A migration criou o valor para o robô poder ser rotulado em vez de
 * contado como resposta humana; a lista do TypeScript nunca recebeu, então o
 * prompt não ensina a categoria ao modelo e ela nunca é escrita.
 */
const ACEITOS_E_NUNCA_ESCRITOS: Record<string, string[]> = {
  intencao: ['RESPOSTA_AUTOMATICA'],
}

describe('as categorias do TypeScript são exatamente as do banco', () => {
  it.each(PARES)('%s: o TypeScript nunca produz o que o banco recusa', (coluna, lista) => {
    const noBanco = valoresDoCheck(coluna)
    // Se a varredura não achar o check, ela para de proteger — e silêncio
    // aqui seria indistinguível de "está tudo certo".
    expect(noBanco.length).toBeGreaterThan(0)

    const soNoTypeScript = Array.from(lista as readonly string[]).filter(
      (v) => !noBanco.includes(v),
    )
    expect(soNoTypeScript).toEqual([])
  })

  it.each(PARES)('%s: o que o banco aceita a mais está registrado', (coluna, lista) => {
    const noBanco = valoresDoCheck(coluna)
    const soNoBanco = noBanco.filter(
      (v) => !Array.from(lista as readonly string[]).includes(v),
    )
    expect(soNoBanco.sort()).toEqual((ACEITOS_E_NUNCA_ESCRITOS[coluna] ?? []).sort())
  })

  /**
   * O CONTROLE. Sem ele, um regex quebrado devolveria `[]` para tudo, o
   * `toEqual` compararia lista vazia com lista vazia em algum caso futuro, e
   * o teste aprovaria qualquer divergência.
   */
  it('CONTROLE: a varredura acha valores de verdade', () => {
    expect(valoresDoCheck('intencao')).toContain('PEDIU_PRECO')
    expect(valoresDoCheck('temperatura')).toContain('quente')
    expect(valoresDoCheck('coluna_que_nao_existe')).toEqual([])
  })
})
