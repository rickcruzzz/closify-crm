import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { assinarUsuarioVerificado, verificarUsuarioVerificado } from './usuario-verificado-header'

describe('usuario-verificado-header', () => {
  beforeEach(() => {
    vi.stubEnv('INTEGRATIONS_ENCRYPTION_KEY', 'chave-de-teste')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('devolve o JSON original quando a assinatura é válida', async () => {
    const usuarioJson = JSON.stringify({ id: 'user-1', email: 'a@b.com' })
    const token = await assinarUsuarioVerificado(usuarioJson)
    expect(await verificarUsuarioVerificado(token)).toBe(usuarioJson)
  })

  // O achado central: um header forjado pelo cliente (sem passar pelo
  // middleware) não pode ser aceito como usuário autenticado. Sem esta
  // checagem, qualquer requisição a rota fora do matcher do middleware
  // devolveria o usuário forjado como se fosse validado.
  it('recusa token com base64 do payload trocado (assinatura não bate mais)', async () => {
    const usuarioJson = JSON.stringify({ id: 'user-1', email: 'a@b.com' })
    const token = await assinarUsuarioVerificado(usuarioJson)
    const [, assinatura] = token.split('.')
    const payloadForjado = Buffer.from(
      JSON.stringify({ usuario: JSON.stringify({ id: 'admin', email: 'admin@x.com' }), criadoEm: Date.now() }),
      'utf8',
    ).toString('base64url')
    const tokenForjado = `${payloadForjado}.${assinatura}`
    expect(tokenForjado).not.toBe(token)
    expect(await verificarUsuarioVerificado(tokenForjado)).toBeNull()
  })

  it('recusa header totalmente inventado, sem passar pelo middleware', async () => {
    expect(await verificarUsuarioVerificado('qualquer-coisa.forjada')).toBeNull()
  })

  it('recusa token sem o separador de assinatura', async () => {
    expect(await verificarUsuarioVerificado('sem-ponto-nenhum')).toBeNull()
  })

  it('recusa token expirado', async () => {
    const usuarioJson = JSON.stringify({ id: 'user-1' })
    vi.useFakeTimers()
    const agora = new Date('2026-01-01T00:00:00Z')
    vi.setSystemTime(agora)
    const token = await assinarUsuarioVerificado(usuarioJson)

    vi.setSystemTime(new Date(agora.getTime() + 61_000))
    expect(await verificarUsuarioVerificado(token)).toBeNull()
    vi.useRealTimers()
  })

  it('assinatura de uma chave não valida em outra', async () => {
    const usuarioJson = JSON.stringify({ id: 'user-1' })
    const token = await assinarUsuarioVerificado(usuarioJson)

    vi.stubEnv('INTEGRATIONS_ENCRYPTION_KEY', 'chave-diferente')
    expect(await verificarUsuarioVerificado(token)).toBeNull()
  })
})
