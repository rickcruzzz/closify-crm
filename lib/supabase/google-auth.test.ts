import { describe, expect, it, vi } from 'vitest'

// Import normal, e nao `await import`: o `vi.mock` abaixo e icado pelo
// Vitest antes de qualquer import, entao o mock ja esta no lugar quando o
// modulo carrega. E `await` no topo do modulo o `tsc` deste projeto recusa
// (TS1378), porque o `module` do tsconfig nao e esnext.
import { signInWithGoogleClient } from './google-auth'

/**
 * Trava que o `prompt` chega ao Google.
 *
 * ## Por que este teste existe
 *
 * O defeito original era uma ausência: `signInWithOAuth` sem `queryParams`.
 * Nada falhava — o login funcionava, só entrava direto sem deixar ninguém
 * escolher a conta. Código que funciona errado não é pego por `tsc`, `lint`
 * nem `build`, e a única forma de travar uma ausência é afirmar a presença.
 *
 * O teste olha o que é PASSADO ao SDK, não o que a função devolve. O retorno
 * é `{ success: true }` com ou sem o parâmetro — foi exatamente assim que ele
 * passou despercebido.
 */

const signInWithOAuth = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}))

vi.mock('@/lib/app-url', () => ({ appUrl: () => 'https://exemplo.test' }))


describe('signInWithGoogleClient', () => {
  it('pede o seletor de conta do Google', async () => {
    signInWithOAuth.mockClear()
    await signInWithGoogleClient()

    const [argumentos] = signInWithOAuth.mock.calls[0]
    expect(argumentos.options.queryParams.prompt).toBe('select_account')
  })

  it('não usa `consent`, que remostraria as permissões todo dia', async () => {
    // `consent` resolveria o mesmo sintoma e traria atrito diário para quem
    // abre o CRM toda manhã — a decisão de permissão já foi tomada na
    // primeira entrada.
    signInWithOAuth.mockClear()
    await signInWithGoogleClient()

    const [argumentos] = signInWithOAuth.mock.calls[0]
    expect(argumentos.options.queryParams.prompt).not.toContain('consent')
  })

  it('mantém o callback, que é o que traz a sessão de volta', async () => {
    signInWithOAuth.mockClear()
    await signInWithGoogleClient()

    const [argumentos] = signInWithOAuth.mock.calls[0]
    expect(argumentos.provider).toBe('google')
    expect(argumentos.options.redirectTo).toBe('https://exemplo.test/auth/callback')
  })

  it('devolve erro legível quando o Google recusa', async () => {
    signInWithOAuth.mockResolvedValueOnce({ error: new Error('qualquer coisa') })
    const r = await signInWithGoogleClient()
    expect(r).toEqual({ error: 'Não foi possível conectar com o Google.' })
  })
})
