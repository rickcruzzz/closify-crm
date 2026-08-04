import { SidebarContent } from '@/components/layout/sidebar-content'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'

export function Sidebar({ workspaces }: { workspaces: WorkspaceSummary[] }) {
  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 border-r md:block">
      <SidebarContent workspaces={workspaces} />
    </aside>
  )
}
