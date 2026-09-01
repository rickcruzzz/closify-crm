/**
 * Decide qual IP identifica o cliente, a partir dos headers da requisição.
 *
 * ## O defeito que esta função passou a existir para corrigir
 *
 * Até 01/09 o código lia só `x-forwarded-for`, com um comentário afirmando
 * que a Vercel o sobrescreve na borda. A afirmação é verdadeira **e deixou de
 * bastar em 19/08**, quando o DNS migrou para o Cloudflare: agora quem chega
 * na Vercel é o Cloudflare, e o IP sobrescrito é o **do proxy**, não o de
 * quem fez a requisição.
 *
 * Medido em produção: 34 requisições seguidas, num limite de 30 por IP, e
 * **nenhum bloqueio**. A tabela de tentativas mostrou por quê:
 *
 *     172.64.222.218   19
 *     172.69.91.78     17
 *     172.70.140.213    1
 *
 * Três IPs do Cloudflare para o mesmo cliente. Ele distribui entre data
 * centers, então o contador se divide sozinho.
 *
 * ## Isso quebrava os dois lados
 *
 * Quem ataca **rotaciona sem fazer nada**: não precisa de proxy nem de VPN, a
 * própria rede do Cloudflare dilui as tentativas.
 *
 * E duas pessoas legítimas atrás do mesmo data center compartilham contador —
 * uma podia bloquear a outra. Num limite de 8 tentativas de login por IP, dois
 * escritórios na mesma cidade se atrapalhariam.
 *
 * ## A ordem, e por que ela não é arbitrária
 *
 * `cf-connecting-ip` é escrito pelo Cloudflare com o IP real do cliente, e ele
 * **sobrescreve** o que o cliente tenha mandado. Só é confiável porque todo o
 * tráfego deste domínio passa por lá — os nameservers apontam para o
 * Cloudflare desde 19/08.
 *
 * `x-forwarded-for` fica como reserva: vale para requisição que chegue direto
 * à Vercel, sem passar pelo proxy (deploy de preview, por exemplo), onde a
 * Vercel é quem sobrescreve.
 *
 * Um cliente pode forjar `cf-connecting-ip` numa requisição que NÃO passe pelo
 * Cloudflare. Nesse caso ele já controlaria o `x-forwarded-for` também, então
 * a ordem não piora nada — e o domínio de produção não tem esse caminho.
 */
export function escolherIp(headers: {
  cfConnectingIp?: string | null
  xForwardedFor?: string | null
}): string {
  const doCloudflare = headers.cfConnectingIp?.trim()
  if (doCloudflare) return doCloudflare

  return extrairIpDoHeader(headers.xForwardedFor)
}

/**
 * Extrai o IP do cliente do header `x-forwarded-for`.
 *
 * O header pode trazer uma cadeia "cliente, proxy1, proxy2"; o primeiro é
 * sempre o mais próximo do cliente.
 *
 * Função pura, sem `server-only`: é a parte com lógica de verdade e por isso a
 * parte testável sem simular uma requisição inteira.
 */
export function extrairIpDoHeader(valorDoHeader: string | null | undefined): string {
  const primeiro = valorDoHeader?.split(',')[0]?.trim()
  return primeiro || 'desconhecido'
}
