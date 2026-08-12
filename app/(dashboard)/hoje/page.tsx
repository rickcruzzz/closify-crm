import type { Metadata } from 'next'

import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceMembers } from '@/lib/leads/queries'
import { getTasksAbertas } from '@/lib/tasks/queries'
import { HojeClient } from '@/components/tasks/hoje-client'

export const metadata: Metadata = { title: 'Hoje' }

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ escopo?: string }>
}) {
  const params = await searchParams
  const { user, workspaceId } = await getCurrentUserAndWorkspace()

  // "Minhas" é o padrão de propósito. Admin que abre a tela e vê 40 tarefas de
  // outras pessoas não tem o que fazer com elas — a tela existe para responder
  // "o que EU faço agora", e a visão da equipe é o caso secundário.
  const escopo = params.escopo === 'equipe' ? 'equipe' : 'minhas'

  const [tasks, members] = await Promise.all([
    getTasksAbertas(workspaceId, escopo === 'equipe' ? null : user.id),
    getWorkspaceMembers(workspaceId),
  ])

  return (
    <HojeClient
      tasks={tasks}
      members={members}
      currentUserId={user.id}
      escopo={escopo}
    />
  )
}
