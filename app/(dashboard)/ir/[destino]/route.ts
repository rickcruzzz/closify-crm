import { redirect } from 'next/navigation'

/**
 * O salto para fora, com o destino no NOSSO código.
 *
 * ## Por que esta rota existe
 *
 * `notificacoes.href` tem `check (href is null or href like '/%')` desde a
 * 0066, e o comentário de lá explica: `href` gravado no banco e renderizado
 * como link é vetor de phishing se puder apontar para fora — quem escrevesse a
 * linha passaria a controlar para onde o clique leva.
 *
 * A trava fica. O que muda é que passa a existir um caminho interno cujo
 * destino externo é decidido AQUI, em arquivo versionado e revisável, e não
 * numa linha de tabela.
 *
 * ## A allowlist é fechada de propósito
 *
 * Um destino que não esteja no mapa devolve 404, e não redireciona para lugar
 * nenhum. Rota de redirecionamento que aceita destino livre é "open redirect",
 * e vira ferramenta de phishing hospedada no próprio domínio: o link começa com
 * `velofunil.com.br`, que é o que a pessoa lê antes de clicar.
 *
 * ## Fica na área logada
 *
 * `app/(dashboard)/` e não `app/`: o único consumidor é o sino, que só existe
 * para quem está dentro. Fora da sessão ela não tem uso, e o middleware já
 * protege o segmento.
 */
const DESTINOS: Record<string, string> = {
  instagram: 'https://www.instagram.com/velofunil',
}

export async function GET(
  _req: Request,
  { params }: { params: { destino: string } },
) {
  const url = DESTINOS[params.destino]
  if (!url) {
    return new Response('destino desconhecido', { status: 404 })
  }
  redirect(url)
}
