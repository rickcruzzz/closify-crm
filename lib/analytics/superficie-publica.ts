/**
 * Onde rastreamento de anúncio pode existir — uma definição, dois consumidores.
 *
 * ## Por que isto virou arquivo próprio
 *
 * A lista de rotas privadas nasceu dentro de `components/analytics/meta-pixel.tsx`
 * e ficou lá enquanto havia um rastreador só. Com o Google Ads entrando, seriam
 * **duas cópias da mesma regra** — e a armadilha já paga deste projeto diz o que
 * acontece: *"duas cópias divergem, e a que diverge em silêncio é a que você
 * escreveu"*.
 *
 * O risco não é hipotético. O comentário original registra que `/hoje` e
 * `/calendario` **faltavam** nesta lista, achado só em 21/08 investigando
 * lentidão: o pixel carregava de verdade nas duas, competindo com a hidratação
 * do React, e produzia erro #418/#423 exclusivamente ali. A lista já ficou
 * incompleta uma vez estando num lugar só; em dois lugares, corrigir um e
 * esquecer o outro é o desfecho provável.
 */

/**
 * O CRM logado nunca carrega rastreador de anúncio.
 *
 * Quem já é cliente não é alvo de atribuição, e reduzir a superfície ao que uma
 * visita paga de fato alcança (landing, cadastro, login, termos, privacidade,
 * conteúdo) é o que mantém o rastreamento do tamanho do que se justifica.
 */
export const PREFIXOS_PRIVADOS = [
  '/dashboard',
  '/kanban',
  '/leads',
  '/settings',
  '/perfil',
  '/onboarding',
  '/bem-vindo',
  '/hoje',
  '/calendario',
]

/**
 * A única rota da área logada onde a conversão do Google Ads pode disparar.
 *
 * ## Por que ela é exceção, e por que é UMA só
 *
 * A conversão da Meta é **servidor** (Conversions API), então o pixel pode ficar
 * fora da área logada inteira sem perder nada. A do Google Ads é **navegador** —
 * a página onde ela acontece precisa ser alcançável, ou não há conversão.
 *
 * E `/bem-vindo` é o ponto por onde os dois caminhos de cadastro passam,
 * rastreado no código e não suposto:
 *
 *     cadastro por e-mail   lib/supabase/actions.ts:137,155,215 -> /verifique-email
 *                           confirmar/page.tsx:82               -> /bem-vindo
 *     entrada pelo Google   app/auth/callback/route.ts:55       -> /bem-vindo
 *
 * Disparar em `/verifique-email` perderia **toda conta criada pelo Google**, que
 * é o caminho de menor atrito e o mais provável em tráfego pago.
 *
 * A exceção é de uma rota, e a tag que entra ali não manda dado pessoal: só o
 * par (conta, ação de conversão). O resto da área logada continua fora.
 */
export const ROTA_DE_CONVERSAO = '/bem-vindo'

/**
 * O domínio de produção. Só ele alimenta rastreador nenhum.
 *
 * Medido em 20/08/2026 nos eventos que a Meta de fato recebeu: além de
 * `www.velofunil.com.br`, chegavam eventos de `localhost` e de previews
 * `closify-crm-dr3t-*.vercel.app`. Num único dia, **18.192 PageViews vieram de
 * `localhost`** — recarregamento em laço durante o desenvolvimento.
 *
 * Não é ruído inofensivo: é com esse conjunto que a plataforma aprende quem
 * perseguir, e milhares de visitas falsas de uma máquina só ensinam o algoritmo
 * a procurar gente que não existe. A conta chega em dinheiro gasto no alvo
 * errado.
 *
 * A checagem é por `hostname` do navegador porque é o que separa os três casos.
 * `NODE_ENV` não serve: preview da Vercel roda como `production`.
 */
export const DOMINIO_DE_PRODUCAO = 'www.velofunil.com.br'

/**
 * A rota está fora do alcance de rastreamento de anúncio?
 *
 * `permitirConversao` existe para o Google Ads poder abrir a exceção de
 * `/bem-vindo` sem duplicar a lista. O Meta Pixel chama sem ele e continua
 * bloqueado na área logada inteira, como sempre esteve.
 */
export function ehAreaPrivada(
  pathname: string,
  { permitirConversao = false }: { permitirConversao?: boolean } = {},
): boolean {
  if (permitirConversao && pathname === ROTA_DE_CONVERSAO) return false

  return PREFIXOS_PRIVADOS.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  )
}
