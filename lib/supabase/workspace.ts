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

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) {
    redirect('/onboarding')
  }

  return { user, workspaceId: membership.workspace_id }
})
