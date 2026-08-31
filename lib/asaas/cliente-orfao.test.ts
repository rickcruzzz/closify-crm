import { describe, expect, it } from 'vitest'

import { AsaasApiError } from '@/lib/asaas/client'
import { ehClienteDeOutraConta } from '@/lib/asaas/cliente-orfao'

describe('ehClienteDeOutraConta', () => {
  /**
   * O caso que motivou a função: 13 das 15 linhas de `subscriptions` ficaram
   * com `asaas_customer_id` da conta velha quando o CNPJ mudou em 31/08.
   */
  it('reconhece 404 — o cliente não existe nesta conta', () => {
    expect(
      ehClienteDeOutraConta(new AsaasApiError(404, '/customers/cus_1', 'not found')),
    ).toBe(true)
  })

  it('reconhece 400 — o Asaas também recusa id desconhecido assim', () => {
    expect(
      ehClienteDeOutraConta(new AsaasApiError(400, '/customers/cus_1', 'invalid_object')),
    ).toBe(true)
  })

  /**
   * Estes três são a razão de a função existir em vez de um `catch` vazio.
   *
   * Tratar indisponibilidade como "cliente ausente" faria o checkout criar
   * cliente e assinatura novos toda vez que o Asaas piscasse — cobrança
   * duplicada por retry cego, que é pior que o defeito original.
   */
  it('não engole 500 — o Asaas está com problema, o cliente pode existir', () => {
    expect(
      ehClienteDeOutraConta(new AsaasApiError(500, '/customers/cus_1', 'server error')),
    ).toBe(false)
  })

  it('não engole 401 — chave errada não é cliente ausente', () => {
    expect(
      ehClienteDeOutraConta(new AsaasApiError(401, '/customers/cus_1', 'unauthorized')),
    ).toBe(false)
  })

  it('não engole tempo esgotado, que o client marca com status 0', () => {
    expect(
      ehClienteDeOutraConta(new AsaasApiError(0, '/customers/cus_1', 'Tempo esgotado')),
    ).toBe(false)
  })

  it('não engole erro que nem veio do Asaas', () => {
    expect(ehClienteDeOutraConta(new Error('qualquer outra coisa'))).toBe(false)
    expect(ehClienteDeOutraConta(null)).toBe(false)
    expect(ehClienteDeOutraConta('404')).toBe(false)
  })
})
