import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  // /onboarding também exige sessão: fica no grupo (auth), que não tem guard
  // de layout, então sem isso a tela renderiza pra anônimo antes da Server
  // Action recusar. Defesa em profundidade, não a única barreira.
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/kanban') ||
    pathname.startsWith('/leads') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/perfil') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/bem-vindo')

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Sessão sem e-mail confirmado não entra no produto.
  //
  // Até aqui, a única coisa que segurava isso era a caixa "Confirm email" do
  // painel do Supabase: com ela ligada, `signUp` não devolve sessão, então não
  // há cookie e a pessoa cai no `!user` acima. Desligar aquela opção — ou
  // qualquer caminho futuro que emita sessão antes da confirmação — abriria o
  // dashboard inteiro para e-mail não verificado, e nada no código diria nada.
  // É o mesmo tipo de regra que só existia fora do código e este projeto já
  // pagou caro três vezes por isso.
  //
  // Não dá para descer ao banco como nos limites de plano: `auth.users` não é
  // alcançável pela RLS do app. O middleware é o ponto mais baixo disponível.
  //
  // Conta criada por provedor externo já vem com `email_confirmed_at`
  // preenchido — quem entra pelo Google não é afetado.
  if (user && !user.email_confirmed_at && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/verifique-email'
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/cadastro')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
