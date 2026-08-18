/**
 * Extrai o IP do cliente do header `x-forwarded-for`.
 *
 * Função pura, sem `server-only`: é a parte com lógica de verdade (o header
 * pode trazer uma cadeia "cliente, proxy1, proxy2", o primeiro é sempre o
 * mais próximo do cliente) e por isso a parte testável sem simular uma
 * requisição inteira. Separada de `lib/request-ip.ts`, que lê `next/headers`
 * e não pode ser importado fora de Server Component.
 */
export function extrairIpDoHeader(valorDoHeader: string | null): string {
  const primeiro = valorDoHeader?.split(',')[0]?.trim()
  return primeiro || 'desconhecido'
}
