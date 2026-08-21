import { cache } from 'react'
import { headers } from 'next/headers'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { verificarUsuarioVerificado } from '@/lib/supabase/usuario-verificado-header'

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
  const token = listaDeHeaders.get('x-vf-usuario-verificado')
  if (token) {
    // `verificarUsuarioVerificado` recusa qualquer coisa sem assinatura HMAC
    // válida do próprio middleware — um header forjado pelo cliente (ou
    // vazando de rota fora do matcher) devolve `null` aqui e cai para a ida
    // de rede abaixo, nunca é aceito como usuário autenticado.
    const usuarioJson = await verificarUsuarioVerificado(token)
    if (usuarioJson) {
      try {
        return JSON.parse(usuarioJson) as User
      } catch {
        // Não deveria acontecer (o próprio middleware serializa antes de
        // assinar), mas cair para a ida de rede é mais seguro que quebrar a
        // navegação inteira.
      }
    }
  }

  // Sem o header, ou header inválido: rota fora do matcher do middleware
  // (ex.: Server Action chamada de rota não listada) ou execução local sem
  // middleware. Volta ao caminho de rede, mesmo comportamento de antes.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
