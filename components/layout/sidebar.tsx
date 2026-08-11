import { SidebarContent } from '@/components/layout/sidebar-content'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'

export function Sidebar({ workspaces, activeWorkspaceId }: { workspaces: WorkspaceSummary[]
  activeWorkspaceId: string }) {
  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 border-r md:block">
      <SidebarContent workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
    </aside>
  )
}
