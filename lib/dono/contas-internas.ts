/**
 * Contas que existem por razão operacional, não porque alguém comprou.
 *
 * ## Por que isto precisa existir
 *
 * A conta `google.review@velofunil.com.br` foi criada para a verificação OAuth
 * do Google, e recebeu Pro de cortesia porque as integrações são recurso pago —
 * sem Pro, o revisor não veria o botão "Conectar" e reprovaria de novo.
 *
 * O efeito colateral, medido em 20/08: a Central passou a dizer **R$ 98/mês**
 * quando a receita real é **R$ 49**. Um painel que existe para responder
 * "quanto entra por mês" não pode contar dinheiro que ninguém pagou — e o erro
 * é do tipo que passa despercebido justamente porque o número fica maior.
 *
 * ## Por que uma lista explícita, e não um padrão no e-mail
 *
 * Este projeto já quase apagou uma cliente real por causa de um regex de
 * "parece teste": `testei122@gmaa2il.com` casa com qualquer padrão de teste e é
 * pessoa de verdade, dona de uma empresa com contatos e negócios (ver
 * `lib/dono/dominios.ts`). Lista conferida uma a uma é chata de manter e nunca
 * apaga o cliente errado.
 */

/** E-mails de contas internas. Comparado em minúsculas. */
const EMAILS_INTERNOS = new Set(['google.review@velofunil.com.br'])

/**
 * Verdadeiro quando a conta existe por razão operacional nossa.
 *
 * Contas internas continuam aparecendo na lista de empresas — esconder seria
 * pior, porque elas existem de verdade e ocupam espaço no banco. O que muda é
 * que não entram na contagem de dinheiro.
 */
export function ehContaInterna(email: string | null | undefined): boolean {
  if (!email) return false
  return EMAILS_INTERNOS.has(email.trim().toLowerCase())
}
