import Link from 'next/link'

import { SidebarNav } from '@/components/layout/sidebar-nav'
import { WorkspaceSwitcher, type WorkspaceSummary } from '@/components/layout/workspace-switcher'
import { UserMenu, type CurrentUser } from '@/components/layout/user-menu'
import { Logo } from '@/components/branding/logo'
import { DialogoDeFeedback } from '@/components/feedback/dialogo-de-feedback'
import type { DecisaoDeNovaEmpresa } from '@/lib/plans/multi-empresa'

export function SidebarContent({
  workspaces,
  activeWorkspaceId,
  currentUser,
  tarefasDoDia,
  conversasEsperando,
  novaEmpresa,
  onNavigate,
}: {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  currentUser: CurrentUser
  /** Quantas tarefas minhas vencem hoje ou já venceram — o badge do "Hoje". */
  tarefasDoDia: number
  conversasEsperando: number
  /**
   * Se esta pessoa pode criar outra empresa, decidido no SERVIDOR.
   *
   * Vem de `decidirNovaEmpresa`, que usa `pro_vigente`/`em_trial` — as mesmas
   * funcoes da trigger. Antes o seletor deduzia da coluna `plan`, e durante o
   * trial ela diz 'pro' enquanto o banco recusa a criacao.
   */
  novaEmpresa: DecisaoDeNovaEmpresa
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link href="/dashboard" className="px-2.5 py-2">
        <Logo size="sm" />
      </Link>
      <WorkspaceSwitcher
        workspaces={workspaces}
        activeId={activeWorkspaceId}
        novaEmpresa={novaEmpresa}
      />
      <SidebarNav
        onNavigate={onNavigate}
        tarefasDoDia={tarefasDoDia}
        conversasEsperando={conversasEsperando}
      />
      {/* `mt-auto`: empurra o rodapé de conta pro fim físico do sidebar, não
          logo depois do último item do menu, em telas com poucos itens
          (a maioria) sobrava um vão vazio grande entre o menu e o rodapé.
          Seguro fazer isso porque app/(dashboard)/layout.tsx já trava a
          altura do sidebar em `h-dvh` no container PAI, o `<aside>` nunca
          estica além da tela independente de como o espaço é distribuído
          aqui dentro. Segundo acesso a "Sair", além do avatar no topbar,
          quem não repara no canto superior direito encontra aqui, no
          rodapé fixo, mesmo padrão do Linear/Notion. */}
      {/* Ajuda no rodapé, acima da conta, e separado dos dois grupos do menu.
          É onde Linear, Notion e Vercel a põem, pela mesma razão: pedir ajuda
          não é tarefa do dia. No grupo principal ela competiria com as telas
          que trazem a pessoa de volta; dentro de "Configurações" ficaria fora
          da dobra no celular, e ninguém procura suporte em Configurações.

          Fica FORA de `navGroups` de propósito: não é navegação, é um diálogo,
          e entrar na lista obrigaria `sidebar-nav.tsx` a tratar um item sem
          rota no cálculo de item ativo — que já teve um defeito em que TODO
          item acendia em `/settings`.

          Chega ao celular de graça: `mobile-sidebar.tsx` renderiza este mesmo
          componente. */}
      <div className="border-sidebar-border mt-auto flex flex-col gap-1 border-t pt-3">
        <DialogoDeFeedback />
        <UserMenu currentUser={currentUser} variant="expanded" />
      </div>
    </div>
  )
}
