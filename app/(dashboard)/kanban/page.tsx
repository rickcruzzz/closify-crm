import type { Metadata } from 'next'
import { getBoardDeals, getWorkspaceLeadsForSelect } from '@/lib/deals/queries'
import { getWorkspaceMembers } from '@/lib/leads/queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { PageHeader } from '@/components/layout/page-header'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { GettingStartedCard } from '@/components/kanban/getting-started-card'

export const metadata: Metadata = { title: 'Pipeline' }

export default async function KanbanPage() {
  const { workspaceId } = await getCurrentUserAndWorkspace()

  const [deals, leads, members] = await Promise.all([
    getBoardDeals(workspaceId),
    getWorkspaceLeadsForSelect(workspaceId),
    getWorkspaceMembers(workspaceId),
  ])

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Acompanhe seus negócios em cada etapa do funil."
      />

      {/* Board completamente vazio: mostra o guia acima dele. A condição é
          resolvida no servidor, sobre `deals`, não sobre o resultado do filtro
          do board — quem filtrou até zerar a tela não é um usuário novo e não
          deve receber tutorial. */}
      {deals.length === 0 && <GettingStartedCard />}

      <KanbanBoard initialDeals={deals} leads={leads} members={members} />
    </div>
  )
}
