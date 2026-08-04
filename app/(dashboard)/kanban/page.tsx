import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getBoardDeals, getWorkspaceLeadsForSelect } from '@/lib/deals/queries'
import { getWorkspaceMembers } from '@/lib/leads/queries'
import { PageHeader } from '@/components/layout/page-header'
import { KanbanBoard } from '@/components/kanban/kanban-board'

export default async function KanbanPage() {
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

  const [deals, leads, members] = await Promise.all([
    getBoardDeals(membership.workspace_id),
    getWorkspaceLeadsForSelect(membership.workspace_id),
    getWorkspaceMembers(membership.workspace_id),
  ])

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Acompanhe seus negócios em cada etapa do funil."
      />
      <KanbanBoard initialDeals={deals} leads={leads} members={members} />
    </div>
  )
}
