import { type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

// Lista explícita em vez de "tudo menos assets". O matcher antigo cobria `/`,
// então toda visita à landing, que é estática, pagava um `auth.getUser()`
// contra o Supabase antes de sair o primeiro byte de HTML: ~275ms de TTFB
// medidos em produção, por nada.
//
// `/login` e `/cadastro` precisam continuar aqui: é o `updateSession` que
// manda quem já tem sessão para `/dashboard`. Tirar essas duas rotas mataria
// esse redirecionamento em silêncio.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/kanban/:path*',
    '/leads/:path*',
    '/settings/:path*',
    '/perfil',
    '/onboarding/:path*',
    '/bem-vindo',
    '/login',
    '/cadastro',
    // Não é rota protegida, mas lê `auth.getUser()` num Server Component, que
    // não pode gravar cookie. Sem o middleware aqui, um usuário logado com
    // token expirado apareceria como anônimo na tela de convite e veria
    // "faça login" em vez do aceite. `/auth/callback` não precisa: é Route
    // Handler e grava o cookie por conta própria.
    '/convite/:path*',
    // Mesmo motivo: a sessão de recuperação vem do `/auth/callback` e precisa
    // do refresh de cookie do `updateSession` enquanto a pessoa escolhe a nova
    // senha. Continua FORA de `isProtectedPath` de propósito, mandar para
    // `/login` quem chega com a sessão de recovery quebraria o próprio fluxo.
    '/redefinir-senha',
  ],
}
