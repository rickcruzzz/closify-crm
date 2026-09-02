import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { assinarUsuarioVerificado } from '@/lib/supabase/usuario-verificado-header'

export async function updateSession(request: NextRequest) {
  // Apaga QUALQUER valor deste header vindo do cliente antes de decidir
  // qualquer coisa — sem isso, uma requisição a rota fora do matcher deste
  // middleware chegaria ao RSC com um header forjado que `obterUsuarioAutenticado`
  // aceitaria como se fosse o resultado de `auth.getUser()`. O nome do header
  // por si só não distingue "escrito pelo middleware" de "mandado pelo
  // cliente" — só a assinatura HMAC (ver `usuario-verificado-header.ts`) faz
  // essa distinção depois.
  request.headers.delete('x-vf-usuario-verificado')
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

  // O RSC seguinte faria sua PRÓPRIA `auth.getUser()` — ida de rede idêntica
  // que o middleware acabou de pagar, dobrando o TTFB de toda navegação
  // logada (medido: ~1.2-1.9s, a maior parte é essas duas idas em série, o
  // middleware bloqueia antes do handler rodar). O middleware já validou o
  // JWT contra o Supabase Auth; carimbar o resultado ASSINADO num header
  // interno deixa `obterUsuarioAutenticado` reaproveitar em vez de perguntar
  // de novo, sem abrir bypass: a assinatura HMAC prova que foi este
  // middleware quem escreveu, não o cliente.
  //
  // O header nasce em `request.headers`, não em `supabaseResponse.headers`:
  // só assim ele chega ao Server Component desta MESMA requisição — headers
  // de resposta voltam pro navegador, não seguem para o handler.
  if (user) {
    request.headers.set(
      'x-vf-usuario-verificado',
      await assinarUsuarioVerificado(JSON.stringify(user)),
    )
    supabaseResponse = NextResponse.next({ request })
  }

  const { pathname } = request.nextUrl

  // /onboarding também exige sessão: fica no grupo (auth), que não tem guard
  // de layout, então sem isso a tela renderiza pra anônimo antes da Server
  // Action recusar. Defesa em profundidade, não a única barreira.
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/kanban') ||
    pathname.startsWith('/leads') ||
    pathname.startsWith('/hoje') ||
    // Sem esta linha o teto de sessao e a checagem de e-mail confirmado nao
    // valem para quem navega so por Conversas. Mesmo defeito que /hoje e
    // /calendario ja tiveram, corrigido em 19/08 e repetido aqui ao criar a
    // rota nova: o comentario deste arquivo credita tres incidentes pagos a
    // essa classe, e este e o quarto.
    pathname.startsWith('/conversas') ||
    pathname.startsWith('/calendario') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/perfil') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/bem-vindo')

  /**
   * Teto de sessão: expiração absoluta e timeout de inatividade. Só nas
   * rotas protegidas — aplicar em `/login`, `/redefinir-senha` (sessão de
   * recovery) ou `/convite` (guest lendo o e-mail do convite) derrubaria
   * fluxos que dependem de sessão temporária diferente de "login normal".
   *
   * O JWT do Supabase expira em 1h e é renovado sozinho pelo refresh token —
   * é isso que já faz "fechar a aba não desloga" funcionar, e nada aqui muda
   * esse comportamento. O que faltava era um TETO: sem isto, a sessão vale
   * para sempre enquanto o refresh token for usado. Cookie roubado ou
   * dispositivo esquecido logado continuava bom indefinidamente.
   *
   * Expiração absoluta usa `user.last_sign_in_at`, que o próprio Supabase já
   * mantém — sem tabela nova, sem cookie extra para isso. Só muda em login de
   * verdade (senha, OAuth, magic link), não em cada renovação de token, então
   * é a data certa para "há quanto tempo esta pessoa entrou".
   *
   * Timeout de inatividade PRECISA de um dado diferente: `last_sign_in_at`
   * não muda enquanto a pessoa usa o produto todo dia sem nunca refazer
   * login, então usar só ele aqui derrubaria sessão ativa e quebraria "fechar
   * aba não desloga" na prática. Por isso um cookie próprio, `vf_atividade`,
   * gravado com o instante de CADA passagem por este middleware — é a
   * "última atividade" de verdade, e só ele volta a datar a cada requisição.
   */
  if (user && isProtectedPath) {
    const EXPIRACAO_ABSOLUTA_MS = 30 * 24 * 60 * 60 * 1000 // 30 dias desde o login

    /**
     * Sete dias sem abrir, e a pessoa entra de novo. Era 14.
     *
     * ## Por que um CRM nao segue o prazo de um Notion
     *
     * A divisao no mercado nao e por tamanho de produto, e pelo que ele
     * guarda. Notion, Linear e Slack mantem sessao por meses porque guardam o
     * trabalho da propria pessoa. Salesforce usa 2 horas e o HubSpot 24, e os
     * dois sao CRM — guardam nome, telefone e negociacao de gente que nunca
     * concordou com nada.
     *
     * Sob a LGPD quem responde por esse dado e a empresa cliente, e sessao
     * longa num computador de escritorio e a porta mais comum para acesso
     * indevido. O publico daqui pesa: PME brasileira, computador
     * frequentemente compartilhado no balcao ou na recepcao — a mesma razao
     * pela qual "Sair" ganhou confirmacao em 19/08.
     *
     * ## Sete, e nao tres nem catorze
     *
     * Quem usa o CRM na rotina NUNCA e deslogado: basta abrir uma vez por
     * semana, e quem trabalha com isso abre todo dia. O prazo so alcanca quem
     * sumiu — e nesse caso a sessao aberta nao esta servindo a ninguem, so
     * esperando.
     *
     * Catorze dias deixava a janela aberta por duas semanas num computador
     * que outras pessoas usam. Tres alcancaria ferias curtas e feriado
     * prolongado, cobrando login de quem nao fez nada de errado.
     */
    const TIMEOUT_INATIVIDADE_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias sem nenhuma requisição

    const entrouEm = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0
    const ultimaAtividade = Number(request.cookies.get('vf_atividade')?.value) || entrouEm
    const agora = Date.now()

    const passouDoTeto = entrouEm > 0 && agora - entrouEm > EXPIRACAO_ABSOLUTA_MS
    const ficouInativa = agora - ultimaAtividade > TIMEOUT_INATIVIDADE_MS

    if (passouDoTeto || ficouInativa) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const resposta = NextResponse.redirect(url)
      resposta.cookies.delete('vf_atividade')
      return resposta
    }

    supabaseResponse.cookies.set('vf_atividade', String(agora), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.ceil(TIMEOUT_INATIVIDADE_MS / 1000),
    })
  }

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Sessão sem e-mail confirmado não entra no produto.
  //
  // Até aqui, a única coisa que segurava isso era a caixa "Confirm email" do
  // painel do Supabase: com ela ligada, `signUp` não devolve sessão, então não
  // há cookie e a pessoa cai no `!user` acima. Desligar aquela opção, ou
  // qualquer caminho futuro que emita sessão antes da confirmação, abriria o
  // dashboard inteiro para e-mail não verificado, e nada no código diria nada.
  // É o mesmo tipo de regra que só existia fora do código e este projeto já
  // pagou caro três vezes por isso.
  //
  // Não dá para descer ao banco como nos limites de plano: `auth.users` não é
  // alcançável pela RLS do app. O middleware é o ponto mais baixo disponível.
  //
  // Conta criada por provedor externo já vem com `email_confirmed_at`
  // preenchido, quem entra pelo Google não é afetado.
  if (user && !user.email_confirmed_at && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/verifique-email'
    return NextResponse.redirect(url)
  }

  // O desvio para as boas-vindas de quem nunca configurou nada saiu daqui:
  // era uma consulta a mais em série, por navegação, em cima do `getUser()`
  // acima. Agora mora no `DashboardLayout`, em paralelo com as outras
  // consultas da mesma requisição, mesma regra, sem ida extra. Ver
  // `precisaDeBoasVindas` em `lib/onboarding/estado.ts`.

  if (user && (pathname === '/login' || pathname === '/cadastro')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
