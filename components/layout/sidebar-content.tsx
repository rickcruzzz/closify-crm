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
      <SidebarNav onNavigate={onNavigate} />
      {/* `mt-auto`: empurra o rodapé de conta pro fim físico do sidebar, não
          logo depois do último item do menu, em telas com poucos itens
          (a maioria) sobrava um vão vazio grande entre o menu e o rodapé.
          Seguro fazer isso porque app/(dashboard)/layout.tsx já trava a
          altura do sidebar em `h-dvh` no container PAI, o `<aside>` nunca
          estica além da tela independente de como o espaço é distribuído
          aqui dentro. Segundo acesso a "Sair", além do avatar no topbar,
          quem não repara no canto superior direito encontra aqui, no
          rodapé fixo, mesmo padrão do Linear/Notion. */}
      <div className="border-sidebar-border mt-auto border-t pt-3">
        <UserMenu currentUser={currentUser} variant="expanded" />
      </div>
    </div>
  )
}
