/**
 * O que NÃO merece virar linha em `error_logs`.
 *
 * ## O defeito que isto fecha
 *
 * A tabela nasceu na migration 0046 para responder "o que quebrou para o
 * cliente". Lida em 30/08, ela tinha **73 registros e nenhum de cliente
 * externo**:
 *
 *     67  de localhost:3000, :3979, :3984, :3985
 *          — servidores que o próprio agente subiu durante os testes
 *      4  da conta de demonstração, numa sessão de teste
 *      2  da conta do dono, usando o produto
 *
 * 92% de ruído. E o custo disso não é espaço em disco: **uma fila com 70
 * linhas de lixo ensina a ignorar a fila inteira**, e junto com o item chato
 * vai embora o erro que importa. É a mesma lição que a Central do Dono pagou
 * em 20/08, quando 8 de 11 alertas eram e-mails de teste e a fila só voltou a
 * ser lida depois de cair para 4.
 *
 * ## Por que a URL, e não o ambiente do servidor
 *
 * A rota roda na Vercel em todos os casos — `NODE_ENV` e `VERCEL_ENV` dizem
 * "production" mesmo quando quem reportou foi um navegador em `localhost`
 * apontando para a API publicada. O único sinal confiável de onde a pessoa
 * estava é a URL que o navegador mandou.
 *
 * ## O que esta função NÃO decide
 *
 * Conta interna. Erro do dono e da conta de demonstração **continua sendo
 * gravado**, marcado com `interno = true` — foi um registro desses, de
 * `origem: global`, que resolveu a tela preta de 24/08. Descartá-lo teria
 * custado a investigação inteira. Separar é o que resolve; jogar fora, não.
 */

/**
 * Hosts que significam "isto é máquina de desenvolvimento".
 *
 * `.local` cobre o Bonjour do macOS e o nome de rede que o `next dev` anuncia
 * quando escuta em todas as interfaces — foi por uma dessas que a Central do
 * Dono precisou de gate de host próprio (`lib/dono/ambiente.ts`).
 */
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

/**
 * Verdadeiro quando o erro veio de uma máquina de desenvolvimento e não deve
 * virar linha na tabela.
 *
 * URL ausente ou ilegível devolve `false` — na dúvida, GRAVA. Um erro de
 * cliente perdido é pior que uma linha de ruído a mais, e a rota já tem rate
 * limit de 30/hora por IP para impedir que isso vire enchente.
 */
export function ehRuidoDeDesenvolvimento(url: string | null | undefined): boolean {
  if (!url) return false

  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    // String que não é URL não prova nada sobre a origem.
    return false
  }

  if (HOSTS_LOCAIS.has(host)) return true
  // `meu-mac.local`, `maquina.localdomain` e afins.
  if (host.endsWith('.local') || host.endsWith('.localdomain')) return true
  // Faixas privadas: o `next dev` escuta em todas as interfaces, então o
  // mesmo servidor local é alcançável pelo IP da máquina na rede.
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true

  return false
}
