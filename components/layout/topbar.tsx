import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu, type CurrentUser } from '@/components/layout/user-menu'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'

export function Topbar({
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
    <header className="bg-background/80 sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm">
      <MobileSidebar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        currentUser={currentUser}
        tarefasDoDia={tarefasDoDia}
      />
      <div className="flex-1" />
      <ThemeToggle />
      <UserMenu currentUser={currentUser} />
    </header>
  )
}
