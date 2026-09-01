import 'server-only'

import { headers } from 'next/headers'

import { escolherIp } from '@/lib/request-ip-parse'

/**
 * O IP de quem fez a requisição.
 *
 * Prefere `cf-connecting-ip`, que o Cloudflare preenche com o IP real do
 * cliente. `x-forwarded-for` sozinho traz o IP do PROXY desde que o DNS migrou
 * para lá em 19/08 — e como o Cloudflare distribui entre data centers, o
 * contador de rate limit se dividia entre três ou mais IPs para a mesma
 * pessoa. Ver `lib/request-ip-parse.ts` para a medição que revelou isso.
 */
export async function ipDaRequisicao(): Promise<string> {
  const h = await headers()
  return escolherIp({
    cfConnectingIp: h.get('cf-connecting-ip'),
    xForwardedFor: h.get('x-forwarded-for'),
  })
}
