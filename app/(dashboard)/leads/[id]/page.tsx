import { notFound } from 'next/navigation'

import { getLeadById, getWorkspaceMembers } from '@/lib/leads/queries'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { LeadDetailClient } from '@/components/leads/lead-detail-client'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  // Quem pode corrigir atividade: o autor dela ou um admin. A action refaz
  // essa checagem no servidor — aqui é só para não exibir um menu de ações
  // que resultaria em erro.
  const [result, members, { data: isAdmin }] = await Promise.all([
    getLeadById(workspaceId, id),
    getWorkspaceMembers(workspaceId),
    supabase.rpc('is_workspace_admin', { target_workspace_id: workspaceId }),
  ])
  if (!result) {
    notFound()
  }

  return (
    <LeadDetailClient
      lead={result.lead}
      activities={result.activities}
      members={members}
      currentUserId={user.id}
      isAdmin={!!isAdmin}
    />
  )
}
