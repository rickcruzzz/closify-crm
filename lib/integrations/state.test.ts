import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assinarEstado, verificarEstado } from './state'

const CHAVE_DE_TESTE = 'a'.repeat(64)

describe('assinarEstado/verificarEstado', () => {
  beforeEach(() => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = CHAVE_DE_TESTE
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('verifica exatamente o que foi assinado', () => {
    const token = assinarEstado({
      workspaceId: 'ws-1',
      provider: 'google_calendar',
      userId: 'user-1',
      nonce: 'abc123',
    })

    const payload = verificarEstado(token)

    expect(payload?.workspaceId).toBe('ws-1')
    expect(payload?.provider).toBe('google_calendar')
    expect(payload?.nonce).toBe('abc123')
  })

  it('recusa state com assinatura adulterada', () => {
    const token = assinarEstado({ workspaceId: 'ws-1', provider: 'gmail', userId: 'user-1', nonce: 'x' })
    const [base64] = token.split('.')
    const adulterado = `${base64}.assinaturaforjada`

    expect(verificarEstado(adulterado)).toBeNull()
  })

  it('recusa state assinado com outra chave', () => {
    const token = assinarEstado({ workspaceId: 'ws-1', provider: 'gmail', userId: 'user-1', nonce: 'x' })
    process.env.INTEGRATIONS_ENCRYPTION_KEY = 'b'.repeat(64)

    expect(verificarEstado(token)).toBeNull()
  })

  it('recusa formato sem o separador esperado', () => {
    expect(verificarEstado('nao-tem-ponto-nenhum')).toBeNull()
  })

  it('recusa state expirado (mais de 10 minutos)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = assinarEstado({ workspaceId: 'ws-1', provider: 'whatsapp', userId: 'user-1', nonce: 'x' })

    vi.setSystemTime(new Date('2026-01-01T00:11:00Z'))
    expect(verificarEstado(token)).toBeNull()
  })

  it('aceita state a poucos segundos do limite', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = assinarEstado({ workspaceId: 'ws-1', provider: 'whatsapp', userId: 'user-1', nonce: 'x' })

    vi.setSystemTime(new Date('2026-01-01T00:09:00Z'))
    expect(verificarEstado(token)?.workspaceId).toBe('ws-1')
  })
})
