import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

// `getCurrentUserAndWorkspace` e `lerEstadoDoOnboarding` cada uma tinha sua
// própria chamada a `auth.getUser()`, com seu próprio `cache()`, o cache do
// React deduplica chamadas repetidas à MESMA função, não duas funções
// diferentes que fazem a mesma coisa. Resultado: 2 idas redundantes ao
// Supabase Auth na mesma navegação do dashboard. Esta função única é o que as
// duas passam a chamar, e aí o cache por requisição funciona de verdade.
export const obterUsuarioAutenticado = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
