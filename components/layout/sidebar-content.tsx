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
      <Link href="/dashboard" className="px-2.5 py-2">
        <Logo size="sm" />
      </Link>
      <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />
      {/* Sem `flex-1`, de propósito: o rodapé de conta vem logo depois do
          último item, não empurrado pro fim físico da tela — ver
          app/(dashboard)/layout.tsx pro porquê disso não deixar mais o
          sidebar rolar embora com o conteúdo. */}
      <SidebarNav onNavigate={onNavigate} />
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
