import { SidebarContent } from '@/components/layout/sidebar-content'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'
import type { CurrentUser } from '@/components/layout/user-menu'

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  currentUser,
  tarefasDoDia,
  conversasEsperando,
}: {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  currentUser: CurrentUser
  tarefasDoDia: number
  conversasEsperando: number
}) {
  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 border-r md:block">
      <SidebarContent
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        currentUser={currentUser}
        tarefasDoDia={tarefasDoDia}
        conversasEsperando={conversasEsperando}
      />
    </aside>
  )
}
