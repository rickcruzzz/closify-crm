import { SidebarContent } from '@/components/layout/sidebar-content'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'
import type { CurrentUser } from '@/components/layout/user-menu'
import type { DecisaoDeNovaEmpresa } from '@/lib/plans/multi-empresa'

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  currentUser,
  tarefasDoDia,
  conversasEsperando,
  novaEmpresa,
}: {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  currentUser: CurrentUser
  tarefasDoDia: number
  conversasEsperando: number
  /**
   * Se esta pessoa pode criar outra empresa, decidido no SERVIDOR.
   *
   * Vem de `decidirNovaEmpresa`, que usa `pro_vigente`/`em_trial` — as mesmas
   * funcoes da trigger. Antes o seletor deduzia da coluna `plan`, e durante o
   * trial ela diz 'pro' enquanto o banco recusa a criacao.
   */
  novaEmpresa: DecisaoDeNovaEmpresa
}) {
  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 border-r md:block">
      <SidebarContent
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        currentUser={currentUser}
        tarefasDoDia={tarefasDoDia}
        conversasEsperando={conversasEsperando}
        novaEmpresa={novaEmpresa}
      />
    </aside>
  )
}
