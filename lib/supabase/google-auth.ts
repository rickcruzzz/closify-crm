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
      queryParams: {
        // ## Sem isto, o Google entra DIRETO e ninguem escolhe nada
        //
        // O padrao do Google e pular toda tela quando ha uma unica conta
        // logada no navegador e o app ja foi autorizado antes. Do lado de
        // quem clica, "Entrar com Google" vira uma piscada e a pessoa ja esta
        // dentro — sem ver com qual identidade entrou.
        //
        // Num CRM isso e pior que abrupto. Quem trabalha tem conta pessoal e
        // de trabalho no mesmo navegador, e entrar com a errada significa
        // criar uma empresa paralela sem perceber, ou nao achar os proprios
        // contatos e concluir que o sistema perdeu tudo.
        //
        // `select_account` faz o Google sempre perguntar. E o comportamento
        // de Slack, Notion e Linear, e a tela e do proprio Google — nenhuma
        // pagina nossa no caminho.
        //
        // NAO e `consent`: aquele remostra as permissoes em TODA entrada, e
        // quem abre o CRM diariamente veria a mesma tela de autorizacao todo
        // dia. Atrito que nao protege de nada, porque a decisao ja foi tomada
        // na primeira vez.
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    return { error: 'Não foi possível conectar com o Google.' }
  }

  return { success: true }
}
