import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu, type CurrentUser } from '@/components/layout/user-menu'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'
import type { DecisaoDeNovaEmpresa } from '@/lib/plans/multi-empresa'

export function Topbar({
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
  /** Se pode criar outra empresa, decidido no servidor. */
  novaEmpresa: DecisaoDeNovaEmpresa
}) {
  return (
    <header className="bg-background/80 sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm">
      <MobileSidebar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        currentUser={currentUser}
        tarefasDoDia={tarefasDoDia}
        conversasEsperando={conversasEsperando}
        novaEmpresa={novaEmpresa}
      />
      <div className="flex-1" />
      <ThemeToggle />
      <UserMenu currentUser={currentUser} />
    </header>
  )
}
