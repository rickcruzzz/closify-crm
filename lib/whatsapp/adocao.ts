/**
 * As decisões puras do caminho de adoção e do número que ficou para trás.
 *
 * ## Por que moram fora de `actions.ts` e de `zapi.ts`
 *
 * Os dois são `'use server'` / `server-only`, e a tela também precisa de uma
 * destas perguntas (`deveConfirmarNumero`). Aqui não há rede nem banco, então
 * o componente importa sem arrastar segredo, e o teste roda sem simular nada.
 */

import type { EstadoDaConexao } from '@/lib/plans/max'

/**
 * Teto de cada ida à Z-API DENTRO da adoção.
 *
 * ## O defeito que isto fecha (22/10): o botão "Adotar instância" girando para
 * sempre em produção
 *
 * A produção saiu da Vercel para a **Netlify**, e lá a função tem ~10s por
 * padrão. `adotarInstancia` faz, em série, sessão + plano + leitura da conexão
 * (Supabase), `GET /status` (Z-API), o `insert`, e os quatro `PUT` de webhook
 * (Z-API, em paralelo). Com o teto genérico de `zapi.ts`, 8s por chamada, o pior
 * caso era **8 + 8 + o Supabase ≈ 17s**: a plataforma mata a função, a Server
 * Action rejeita no navegador, e `enviar()` — sem `finally` — nunca desligava o
 * spinner. Nenhum toast, nenhum log do nosso lado.
 *
 * 3,5s por etapa dão 7s de Z-API no pior caso, e sobram ~3s para o Supabase.
 * `GET /status` e os `PUT` medidos em 17/09 respondem bem abaixo de um segundo:
 * quem passa disto está com problema, e esperar mais não o resolve.
 */
export const TIMEOUT_DA_ADOCAO_MS = 3_500

/**
 * A chamada morreu por TEMPO, e não por recusa?
 *
 * A diferença muda a frase da tela. Antes, todo erro do `GET /status` virava
 * *"A Z-API não reconheceu este ID e token"* — e quem colou as credenciais
 * certas ia conferir o painel por nada, quando bastava tentar de novo.
 *
 * `AbortError` é o que o `fetch` lança quando o `AbortController` de `chamar`
 * dispara; `TimeoutError` é o de `AbortSignal.timeout`, aceito para não
 * depender de qual dos dois o transporte usar amanhã.
 */
export function estourouOTempo(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false
  const nome = (erro as { name?: unknown }).name
  return nome === 'AbortError' || nome === 'TimeoutError'
}

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
