import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

// Layout e cada page do (dashboard) precisam do usuário logado + workspace_id.
// React cache() memoiza por request: mesma consulta chamada em layout.tsx e
// na page correspondente reaproveita o resultado em vez de bater no Supabase
// duas vezes na mesma navegação.
export const getCurrentUserAndWorkspace = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // order by created_at é obrigatório: sem ele o Postgres pode devolver um
  // workspace diferente entre requests para quem participa de mais de um
  // (convites já existem), e a gravação cairia no workspace errado.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .order('workspace_id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  return { user, workspaceId: membership.workspace_id }
})
