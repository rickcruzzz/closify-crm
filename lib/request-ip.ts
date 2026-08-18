import 'server-only'

import { headers } from 'next/headers'

import { extrairIpDoHeader } from '@/lib/request-ip-parse'

/**
 * O IP de quem fez a requisição, do jeito que dá para confiar dentro da Vercel.
 *
 * `x-forwarded-for` é forjável em geral, mas a Vercel SOBRESCREVE esse header
 * na borda antes de a requisição chegar à função — não é o cliente quem
 * escreve o valor final. É a mesma garantia que a documentação da Vercel dá
 * para `x-real-ip`/`x-forwarded-for` em Edge e Node functions.
 */
export async function ipDaRequisicao(): Promise<string> {
  return extrairIpDoHeader((await headers()).get('x-forwarded-for'))
}
