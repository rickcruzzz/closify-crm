import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EnterpriseCard } from '@/components/settings/enterprise-card'
import { IntegrationCard } from '@/components/settings/integration-card'
import { rotuloDoPlano } from '@/lib/plans'

vi.mock('@/lib/integrations/actions', () => ({
  desconectarIntegracao: vi.fn(),
  testarConexaoIntegracao: vi.fn(),
}))
vi.mock('@/components/settings/pro-upsell-dialog', () => ({
  ProUpsellDialog: () => null,
}))
vi.mock('@/components/settings/preparar-conexao-google', () => ({
  PrepararConexaoGoogle: () => null,
}))

describe('identidade e recursos Enterprise', () => {
  it('mostra Enterprise antes dos direitos Max e Pro sem alterar outros planos', () => {
    expect(rotuloDoPlano('free', true, true, true)).toBe('Enterprise')
    expect(rotuloDoPlano('pro', true, true)).toBe('Max')
    expect(rotuloDoPlano('free', false, false)).toBe('Free')
  })

  it('apresenta cinco colaboradores sem preços ou comparação de outros planos', () => {
    const html = renderToStaticMarkup(createElement(EnterpriseCard))
    expect(html).toContain('Enterprise')
    expect(html).toContain('5')
    expect(html).not.toMatch(/R\$|\/mês|Compare os planos|Plano Max|Plano Pro/)
  })

  for (const provider of ['google_calendar', 'gmail', 'whatsapp'] as const) {
    it(`inclui ${provider} mesmo quando a coluna do workspace ainda diz Free`, () => {
      const html = renderToStaticMarkup(
        createElement(IntegrationCard, {
          provider,
          isAdmin: true,
          status: 'disconnected',
          accountLabel: null,
          lastError: null,
          uso: 0,
          plano: 'free',
          temEnterprise: true,
        }),
      )
      expect(html).toContain('Incluído no Enterprise')
      expect(html).not.toMatch(
        /Conhecer o plano Pro|Plano Max|R\$|Migrando para o WhatsApp/,
      )
      if (provider === 'whatsapp') expect(html).toContain('href="/conversas"')
      else expect(html).toContain('Conectar ')
    })
  }

  it('mantém a gestão de integrações restrita a administradores', () => {
    const html = renderToStaticMarkup(
      createElement(IntegrationCard, {
        provider: 'gmail',
        isAdmin: false,
        status: 'disconnected',
        accountLabel: null,
        lastError: null,
        uso: 0,
        plano: 'pro',
        temEnterprise: true,
      }),
    )
    expect(html).toContain('Só administradores podem gerenciar integrações.')
    expect(html).not.toContain('Conectar Gmail')
  })
})
