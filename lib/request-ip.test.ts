import { describe, expect, it } from 'vitest'

import { escolherIp, extrairIpDoHeader } from './request-ip-parse'

describe('extrairIpDoHeader', () => {
  it('usa o primeiro IP da cadeia, que é o mais próximo do cliente', () => {
    expect(extrairIpDoHeader('203.0.113.5, 70.41.3.18, 150.172.238.178')).toBe('203.0.113.5')
  })

  it('aceita um único IP sem vírgula', () => {
    expect(extrairIpDoHeader('203.0.113.5')).toBe('203.0.113.5')
  })

  it('tira espaço em volta, o formato do header varia entre proxies', () => {
    expect(extrairIpDoHeader('  203.0.113.5  , 70.41.3.18')).toBe('203.0.113.5')
  })

  // Acontece em dev local (`next start` fora da Vercel), onde ninguém
  // preenche o header. Uma chave constante ali é inofensiva: nunca é o caso
  // em produção, onde a Vercel sempre escreve o header antes da função rodar.
  it('devolve "desconhecido" quando o header não existe', () => {
    expect(extrairIpDoHeader(null)).toBe('desconhecido')
  })

  it('devolve "desconhecido" para header vazio', () => {
    expect(extrairIpDoHeader('')).toBe('desconhecido')
  })
})

/**
 * ## O IP real por trás do Cloudflare
 *
 * Até 01/09 o código lia só `x-forwarded-for`, com um comentário afirmando
 * que a Vercel o sobrescreve na borda. Verdadeiro, e insuficiente desde que o
 * DNS migrou para o Cloudflare em 19/08: quem chega na Vercel é o proxy, e o
 * IP sobrescrito é o DELE.
 *
 * Medido em produção: 34 requisições seguidas num limite de 30, e **nenhum
 * bloqueio**. A tabela de tentativas explicou:
 *
 *     172.64.222.218   19
 *     172.69.91.78     17
 *     172.70.140.213    1
 *
 * Três IPs do Cloudflare para o mesmo cliente. Quem ataca rotaciona sem fazer
 * nada, e duas pessoas legítimas atrás do mesmo data center compartilhavam
 * contador — uma podia bloquear a outra.
 */
describe('escolherIp', () => {
  it('prefere o IP real que o Cloudflare informa', () => {
    expect(
      escolherIp({ cfConnectingIp: '189.4.5.6', xForwardedFor: '172.64.222.218' }),
    ).toBe('189.4.5.6')
  })

  it('usa x-forwarded-for quando não há Cloudflare na frente', () => {
    expect(escolherIp({ cfConnectingIp: null, xForwardedFor: '189.4.5.6' })).toBe('189.4.5.6')
  })

  it('cabeçalho em branco não vira IP', () => {
    expect(escolherIp({ cfConnectingIp: '   ', xForwardedFor: '189.4.5.6' })).toBe('189.4.5.6')
    expect(escolherIp({ cfConnectingIp: null, xForwardedFor: null })).toBe('desconhecido')
  })

  /**
   * O caso que motivou a correção: dois pedidos do MESMO cliente, chegando por
   * data centers diferentes, precisam gerar a MESMA chave de rate limit.
   */
  it('o mesmo cliente por proxies diferentes dá o mesmo IP', () => {
    const a = escolherIp({ cfConnectingIp: '189.4.5.6', xForwardedFor: '172.64.222.218' })
    const b = escolherIp({ cfConnectingIp: '189.4.5.6', xForwardedFor: '172.69.91.78' })
    expect(a).toBe(b)
  })
})
