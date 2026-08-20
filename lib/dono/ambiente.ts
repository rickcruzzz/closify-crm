/**
 * A decisão "isto é acesso local de desenvolvimento?", sozinha.
 *
 * ## Por que num arquivo próprio, separado de `somente-local.ts`
 *
 * O irmão `somente-local.ts` abre com `import 'server-only'`, que existe para
 * quebrar o build se algum client component importar a Central do Dono por
 * engano. O efeito colateral é que o módulo não carrega no Vitest — o pacote
 * `server-only` lança de propósito fora de um Server Component.
 *
 * Um gate de segurança sem teste é um gate que ninguém sabe se funciona, então
 * a lógica que DECIDE mora aqui, pura, e o acesso ao mundo (`headers()`,
 * `notFound()`) fica do outro lado. Mesmo padrão de extração de
 * `mensagemPorContagemDeConexoes` (`lib/integrations/mensagem-bloqueio-pro.ts`).
 *
 * Este arquivo não importa nada e não faz I/O — é seguro em qualquer contexto.
 */

/** Hosts que representam "esta máquina, por dentro". */
const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '[::1]']

/**
 * Verdadeiro só quando o servidor está em desenvolvimento **e** a requisição
 * chegou pela loopback desta máquina.
 *
 * As duas condições, não uma: `NODE_ENV === 'production'` sozinho já derruba a
 * rota na Vercel, mas `next dev` escuta em TODAS as interfaces de rede — com o
 * servidor local rodando, qualquer pessoa no mesmo Wi-Fi abriria
 * `http://<ip-da-máquina>:3000/dono` e veria a base de clientes inteira.
 *
 * @param nodeEnv valor de `process.env.NODE_ENV`
 * @param host cabeçalho `host` da requisição, com porta (ex: `localhost:3000`)
 */
export function ehAmbienteLocal(
  nodeEnv: string | undefined,
  host: string | null | undefined,
): boolean {
  if (nodeEnv !== 'development') return false
  if (!host) return false

  // Prefixo MAIS separador, nunca prefixo sozinho: `localhost.evil.com`
  // começa com `localhost` e não é local nenhum. O host vem com porta
  // (`localhost:3000`) e o IPv6 vem entre colchetes (`[::1]:3000`), então
  // cortar no último `:` para tirar a porta quebraria o IPv6.
  return HOSTS_LOCAIS.some((local) => host === local || host.startsWith(`${local}:`))
}
