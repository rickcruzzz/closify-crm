import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // next carrega o destino pós-login quando o link não é de signup comum —
  // usado pelo fluxo de recuperação de senha pra cair em /redefinir-senha
  // em vez do /dashboard padrão. Allowlist fixa pra não virar open redirect
  // (nunca repassa o valor da query direto pro Location).
  const next = searchParams.get('next')
  const safeNext = next === '/redefinir-senha' ? next : '/dashboard'

  // E-mails de recuperação enviados antes da correção ainda apontam para cá,
  // e chegam SEM `code`: a sessão vem em `#access_token=`, que o servidor não
  // enxerga. Mandar para `/login` fazia a pessoa ver a tela de entrar com um
  // erro cru na barra de endereços. Repassar para `/redefinir-senha` preserva
  // o fragmento no redirect e a tela consegue lê-lo no browser.
  if (!code && next === '/redefinir-senha') {
    return NextResponse.redirect(`${origin}/redefinir-senha`)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Recuperação de senha tem destino próprio e não passa por boas-vindas.
      if (next === '/redefinir-senha') {
        return NextResponse.redirect(`${origin}${safeNext}`)
      }

      // Sem workspace, a pessoa acabou de criar a conta. Antes ela caía em
      // `/dashboard`, que só então a mandava para `/onboarding` — um salto
      // seco, sem nenhum sinal de que a conta tinha sido criada. Conferimos
      // aqui e mandamos direto para a tela certa.
      const userId = data.user?.id
      if (userId) {
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()

        if (!membership) {
          return NextResponse.redirect(`${origin}/bem-vindo`)
        }
      }

      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
