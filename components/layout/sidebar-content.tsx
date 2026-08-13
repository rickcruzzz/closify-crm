import Link from 'next/link'

import { SidebarNav } from '@/components/layout/sidebar-nav'
import { WorkspaceSwitcher, type WorkspaceSummary } from '@/components/layout/workspace-switcher'
import { UserMenu, type CurrentUser } from '@/components/layout/user-menu'
import { Logo } from '@/components/branding/logo'

export function SidebarContent({
  workspaces,
  activeWorkspaceId,
  currentUser,
  onNavigate,
}: {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  currentUser: CurrentUser
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link href="/dashboard" className="px-1.5 py-2">
        <Logo size="sm" />
      </Link>
      <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />
      <div className="flex-1">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      {/* Segundo acesso a "Sair", além do avatar no topbar — quem não repara
          no canto superior direito encontra aqui, no rodapé fixo, mesmo
          padrão do Linear/Notion. Preenche o vão vazio que sobrava abaixo da
          navegação em telas com poucos itens de menu. */}
      <div className="border-sidebar-border border-t pt-3">
        <UserMenu currentUser={currentUser} variant="expanded" />
      </div>
    </div>
  )
}
