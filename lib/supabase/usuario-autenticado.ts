import { cache } from 'react'
import { headers } from 'next/headers'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

// `getCurrentUserAndWorkspace` e `lerEstadoDoOnboarding` cada uma tinha sua
// própria chamada a `auth.getUser()`, com seu próprio `cache()`, o cache do
// React deduplica chamadas repetidas à MESMA função, não duas funções
// diferentes que fazem a mesma coisa. Resultado: 2 idas redundantes ao
// Supabase Auth na mesma navegação do dashboard. Esta função única é o que as
// duas passam a chamar, e aí o cache por requisição funciona de verdade.
//
// A ida que sobrava depois disso era a do PRÓPRIO middleware: ele também
// chama `auth.getUser()`, em processo separado (edge, antes deste RSC rodar),
// então o `cache()` do React não enxerga as duas como a mesma coisa — TTFB
// pagava duas validações de JWT em série. `lib/supabase/middleware.ts` agora
// carimba o usuário já validado num header interno da MESMA requisição; ler
// esse header evita a segunda ida sem abrir brecha nenhuma, porque quem
// escreveu o header foi o próprio middleware chamando `getUser()` de verdade,
// não um valor que o cliente poderia forjar.
export const obterUsuarioAutenticado = cache(async (): Promise<User | null> => {
  const listaDeHeaders = await headers()
  const bruto = listaDeHeaders.get('x-vf-usuario-verificado')
  if (bruto) {
    try {
      return JSON.parse(bruto) as User
    } catch {
      // Header corrompido não deveria acontecer (só o próprio middleware
      // escreve nele), mas cair para a ida de rede é mais seguro que quebrar
      // a navegação inteira.
    }
  }

  // Sem o header: rota fora do matcher do middleware (ex.: Server Action
  // chamada de rota não listada) ou execução local sem middleware. Volta ao
  // caminho de rede, mesmo comportamento de antes.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
