import { describe, expect, it } from 'vitest'

import { cancelSubscriptionSchema, checkoutSchema } from './billing'

/**
 * O checkout é o ponto onde dinheiro entra. Um documento inválido aqui só era
 * recusado lá no Asaas, devolvendo "Não foi possível iniciar a assinatura" —
 * mensagem que não diz o que corrigir e faz parecer defeito do sistema.
 */

describe('checkoutSchema', () => {
  it('aceita CPF válido, com ou sem pontuação', () => {
    expect(checkoutSchema.safeParse({ cpfCnpj: '529.982.247-25' }).success).toBe(true)
    expect(checkoutSchema.safeParse({ cpfCnpj: '52998224725' }).success).toBe(true)
  })

  it('aceita CNPJ válido', () => {
    expect(checkoutSchema.safeParse({ cpfCnpj: '64.543.748/0001-13' }).success).toBe(true)
  })

  it('normaliza para só dígitos antes de enviar ao Asaas', () => {
    // O Asaas recebe o valor já transformado; mandar com pontuação faz a
    // criação do cliente falhar.
    const r = checkoutSchema.safeParse({ cpfCnpj: '529.982.247-25' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.cpfCnpj).toBe('52998224725')
  })

  it('recusa dígito verificador errado', () => {
    const r = checkoutSchema.safeParse({ cpfCnpj: '529.982.247-24' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain('inválido')
    }
  })

  it('recusa sequência de dígitos iguais', () => {
    expect(checkoutSchema.safeParse({ cpfCnpj: '111.111.111-11' }).success).toBe(false)
  })

  it('recusa tamanho que não é CPF nem CNPJ', () => {
    expect(checkoutSchema.safeParse({ cpfCnpj: '123456789' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ cpfCnpj: '123456789012' }).success).toBe(false)
  })

  it('recusa campo vazio', () => {
    expect(checkoutSchema.safeParse({ cpfCnpj: '' }).success).toBe(false)
  })
})

describe('cancelSubscriptionSchema', () => {
  it('exige a palavra exata', () => {
    expect(cancelSubscriptionSchema.safeParse({ confirmacao: 'CANCELAR' }).success).toBe(
      true,
    )
  })

  it('recusa qualquer outra coisa', () => {
    // Cancelamento para a cobrança de verdade no Asaas: um clique acidental
    // não pode bastar.
    for (const valor of ['cancelar', 'CANCELA', 'sim', '', 'CANCELAR ']) {
      expect(cancelSubscriptionSchema.safeParse({ confirmacao: valor }).success).toBe(
        false,
      )
    }
  })
})
