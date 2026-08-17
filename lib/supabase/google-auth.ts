import { createClient } from '@/lib/supabase/client'
import { appUrl } from '@/lib/app-url'

// Dispara o OAuth do lado do browser (não como Server Action) de propósito:
// o cookie do code_verifier do PKCE precisa sobreviver ao redirect externo
// pro Google e voltar, via Server Action + redirect() pra domínio externo,
// esse cookie se perde (bug conhecido do Next.js App Router com Server
// Actions + redirect cross-origin), deixando o /auth/callback sem conseguir
// trocar o code por sessão e o botão girando pra sempre. O client Supabase
// no browser seta o cookie via document.cookie e já redireciona sozinho.
export async function signInWithGoogleClient() {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${appUrl()}/auth/callback`,
    },
  })

  if (error) {
    return { error: 'Não foi possível conectar com o Google.' }
  }

  return { success: true }
}
