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

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
