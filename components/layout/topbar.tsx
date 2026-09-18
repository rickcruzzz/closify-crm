import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { Sino } from '@/components/layout/sino'
import { UserMenu, type CurrentUser } from '@/components/layout/user-menu'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'
import type { DecisaoDeNovaEmpresa } from '@/lib/plans/multi-empresa'

export function Topbar({
  workspaces,
  activeWorkspaceId,
  currentUser,
  tarefasDoDia,
  conversasEsperando,
  avisosNaoLidos,
  novaEmpresa,
  temMax,
  proVigente,
}: {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  currentUser: CurrentUser
  tarefasDoDia: number
  conversasEsperando: number
  /** Notificações não lidas da empresa ativa, contadas no servidor. */
  avisosNaoLidos: number
  /** Se pode criar outra empresa, decidido no servidor. */
  novaEmpresa: DecisaoDeNovaEmpresa
  temMax: boolean
  /** `pro_vigente()` da empresa ativa. Ver o comentario no switcher. */
  proVigente: boolean
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
        temMax={temMax}
        proVigente={proVigente}
      />
      <div className="flex-1" />
      {/* Antes do tema e da conta, e não depois: a ordem da direita para a
          esquerda vai do mais frequente ao mais raro, e avisar é o único dos
          três que muda sozinho. O sino NÃO ganha cópia no `MobileSidebar` —
          duas entradas para a mesma lista divergem na primeira mudança, e ele
          já cabe aqui nas duas larguras com alvo de 44px. */}
      <Sino naoLidas={avisosNaoLidos} />
      <ThemeToggle />
      <UserMenu currentUser={currentUser} />
    </header>
  )
}
