import { type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

// Lista explícita em vez de "tudo menos assets". O matcher antigo cobria `/`,
// então toda visita à landing — que é estática — pagava um `auth.getUser()`
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
    '/onboarding/:path*',
    '/login',
    '/cadastro',
  ],
}
