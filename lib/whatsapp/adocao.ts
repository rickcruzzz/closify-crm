/**
 * A decisão pura de "pedir o número que ficou para trás".
 *
 * Mora fora de `actions.ts` porque aquele é `'use server'` e a TELA precisa
 * desta pergunta. Aqui não há rede nem banco, então o componente importa sem
 * arrastar segredo, e o teste roda sem simular nada.
 */

import type { EstadoDaConexao } from '@/lib/plans/max'

/**
 * A tela deve pedir ao servidor o número que ficou para trás?
 *
 * ## O teto é UMA vez por estado, decidido no cliente
 *
 * A Server Action já confere de novo antes de gastar a chamada, mas a porta
 * dela não impede o efeito de rodar outra vez: se ela devolver um telefone que
 * não chega à prop depois do `router.refresh()` — gravação que falhou em
 * silêncio, leitura de outra fonte, cache —, o efeito vê o mesmo
 * `conectado` + `null`, chama de novo, e refresca de novo. Laço de Server
 * Action com refresh, sem fim.
 *
 * `jaTentou` é a memória que corta isso, venha o que vier do servidor.
 */
export function deveConfirmarNumero(params: {
  estado: EstadoDaConexao
  telefone: string | null
  jaTentou: boolean
}): boolean {
  if (params.jaTentou) return false
  return params.estado === 'conectado' && !params.telefone
}
