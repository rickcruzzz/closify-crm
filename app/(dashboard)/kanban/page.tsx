import type { Metadata } from 'next'
import { getBoardDeals, getWorkspaceLeadsForSelect } from '@/lib/deals/queries'
import { getWorkspaceMembers } from '@/lib/leads/queries'
import { getProximaAcaoPorNegocio } from '@/lib/tasks/queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { PageHeader } from '@/components/layout/page-header'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { GettingStartedCard } from '@/components/kanban/getting-started-card'

export const metadata: Metadata = { title: 'Pipeline' }

export default async function KanbanPage() {
  const { user, workspaceId } = await getCurrentUserAndWorkspace()

  // Quarta consulta no mesmo `Promise.all`, não uma por card: o board já
  // carrega todos os negócios abertos de uma vez, e uma consulta por card
  // multiplicaria o custo em vez de somar uma leitura.
  const [board, leads, members, proximasAcoes] = await Promise.all([
    getBoardDeals(workspaceId),
    getWorkspaceLeadsForSelect(workspaceId),
    getWorkspaceMembers(workspaceId),
    getProximaAcaoPorNegocio(workspaceId),
  ])

  return (
    // `max-w-none` desfaz o teto de 1160px do layout: o board rola na
    // horizontal e espremê-lo esconderia colunas atrás da rolagem.
    <div className="-mx-4 max-w-none px-4 md:-mx-6 md:px-6">
      <PageHeader
        title="Pipeline"
        description="Acompanhe seus negócios em cada etapa do funil."
      />

      {/* Board completamente vazio: mostra o guia acima dele. A condição é
          resolvida no servidor, sobre `deals`, não sobre o resultado do filtro
          do board — quem filtrou até zerar a tela não é um usuário novo e não
          deve receber tutorial. */}
      {board.deals.length === 0 && <GettingStartedCard />}

      <KanbanBoard
        initialDeals={board.deals}
        totalPorEtapa={board.totalPorEtapa}
        leads={leads}
        members={members}
        currentUserId={user.id}
        // `Map` não sobrevive à serialização servidor→cliente; vai como pares.
        proximasAcoes={Array.from(proximasAcoes)}
      />
    </div>
  )
}
