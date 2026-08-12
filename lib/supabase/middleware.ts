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

  // Quem nunca configurou nada passa pelas boas-vindas antes do produto.
  //
  // Três cuidados, e cada um evita prender alguém fora do sistema:
  //
  // 1. Só desvia quem NÃO tem linha em `onboarding_state`, ou tem com
  //    `not_started`. O backfill da 0030 marcou como `completed` todo mundo
  //    que já tinha empresa, então nenhum usuário atual é afetado — foram 10
  //    de 14 contas.
  // 2. `skipped` e `in_progress` NÃO são desviados. Pular foi decisão da
  //    pessoa, e insistir a cada navegação transformaria escolha em pedágio.
  //    Quem está no meio já está na tela certa.
  // 3. Falha de leitura não desvia. Um erro transitório do banco não pode
  //    empurrar para as boas-vindas quem está trabalhando — em caso de dúvida,
  //    o produto continua aberto.
  //
  // A verificação é uma consulta por navegação em rota protegida, por chave
  // primária. Sai da frente assim que o status muda de `not_started`.
  const precisaDeBoasVindas =
    user &&
    user.email_confirmed_at &&
    isProtectedPath &&
    !pathname.startsWith('/bem-vindo') &&
    !pathname.startsWith('/onboarding')

  if (precisaDeBoasVindas) {
    const { data, error } = await supabase
      .from('onboarding_state')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!error && (!data || data.status === 'not_started')) {
      const url = request.nextUrl.clone()
      url.pathname = '/bem-vindo'
      return NextResponse.redirect(url)
    }
  }

  if (user && (pathname === '/login' || pathname === '/cadastro')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
