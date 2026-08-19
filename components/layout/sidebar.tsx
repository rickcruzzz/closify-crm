import { SidebarContent } from '@/components/layout/sidebar-content'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'
import type { CurrentUser } from '@/components/layout/user-menu'

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  currentUser,
  tarefasDoDia,
}: {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  currentUser: CurrentUser
  tarefasDoDia: number
}) {
  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 border-r md:block">
      <SidebarContent
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        currentUser={currentUser}
        tarefasDoDia={tarefasDoDia}
      />
    </aside>
  )
}
