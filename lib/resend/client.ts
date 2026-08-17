import 'server-only'

import { Resend } from 'resend'

/**
 * Client do Resend criado sob demanda, não na importação do módulo.
 *
 * `new Resend(undefined)` LANÇA `Missing API key`. Como a instância antes era
 * criada no topo do arquivo, qualquer rota que importasse este módulo, direta
 * ou indiretamente, quebrava com 500 no primeiro import, antes de executar
 * uma linha da Server Action.
 *
 * Foi o que aconteceu com o convite de colaborador em produção: a variável
 * `RESEND_API_KEY` não estava definida na Vercel (só existia no `.env.local`,
 * que não é publicado), e o botão "Enviar convite" respondia 500 sem nenhuma
 * mensagem na tela, o diálogo simplesmente não fechava.
 *
 * Criando aqui dentro, a falta da chave vira erro tratável dentro da action,
 * que consegue devolver uma mensagem em vez de derrubar a requisição.
 */
export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'RESEND_API_KEY não está definida no ambiente. Confira a variável no painel de deploy, inclusive o escopo (Production).',
    )
  }

  return new Resend(apiKey)
}
