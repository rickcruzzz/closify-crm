import Link from 'next/link'

import { cn } from '@/lib/utils'

import { SidebarNav } from '@/components/layout/sidebar-nav'
import {
  WorkspaceSwitcher,
  type WorkspaceSummary,
} from '@/components/layout/workspace-switcher'
import { UserMenu, type CurrentUser } from '@/components/layout/user-menu'
import { Logo } from '@/components/branding/logo'
import { DialogoDeFeedback } from '@/components/feedback/dialogo-de-feedback'
import { TituloDeGrupoDaBarra } from '@/components/layout/titulo-de-grupo'
import type { DecisaoDeNovaEmpresa } from '@/lib/plans/multi-empresa'

export function SidebarContent({
  workspaces,
  activeWorkspaceId,
  currentUser,
  tarefasDoDia,
  conversasEsperando,
  novaEmpresa,
  temMax,
  proVigente,
  onNavigate,
  recolhida = false,
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
  /** A empresa ativa tem Max vigente. Vem do layout, sem ida de rede extra. */
  temMax: boolean
  /** `pro_vigente()` da empresa ativa. Ver o comentario no switcher. */
  proVigente: boolean
  onNavigate?: () => void
  /**
   * Barra em modo icone, so no desktop.
   *
   * O mobile nunca passa `true`: `mobile-sidebar.tsx` mostra este mesmo
   * componente dentro de um `Sheet`, e recolher uma gaveta que ja abre e fecha
   * nao significa nada.
   */
  recolhida?: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col gap-4 p-3',
        recolhida && 'items-center px-2',
      )}
    >
      <Link
        href="/kanban"
        aria-label="Velo Funil"
        className={cn(
          'focus-visible:ring-ring shrink-0 rounded-lg py-2 outline-none focus-visible:ring-2',
          recolhida ? 'px-0' : 'px-2.5',
        )}
      >
        {/* Recolhida, o simbolo sozinho. `showWordmark` existe no `Logo` desde
            que ele nasceu e nunca teve consumidor: a marca por extenso nao cabe
            em 4,5rem, e espremer tipografia e o que faz barra recolhida parecer
            barra quebrada. */}
        <Logo size="sm" showWordmark={!recolhida} />
      </Link>

      {/* ## O seletor de empresa SOME quando recolhida, e isso e decisao
          
          Ele carrega nome da empresa, selo do plano e o CTA "Conhecer o Pro".
          Nada disso cabe em 4,5rem, e reduzi-lo a um icone de predio criaria um
          alvo que nao diz o que faz — pior que ausencia, porque ocupa espaco e
          nao informa.
          
          Trocar de empresa continua a um clique: expandir a barra. */}
      {!recolhida && (
        <div className="shrink-0">
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeId={activeWorkspaceId}
            novaEmpresa={novaEmpresa}
            temMax={temMax}
            proVigente={proVigente}
          />
        </div>
      )}
      <div className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1">
        <SidebarNav
          onNavigate={onNavigate}
          tarefasDoDia={tarefasDoDia}
          conversasEsperando={conversasEsperando}
          recolhida={recolhida}
          temEnterprise={
            workspaces.find((w) => w.id === activeWorkspaceId)?.temEnterprise === true
          }
        />
      </div>
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

          O rótulo "SUPORTE" (16/09) é o que faz essa exceção estrutural parar
          de PARECER exceção: para quem lê a barra, ele é o terceiro bloco, com
          o mesmo peso dos outros dois. O componente do rótulo é compartilhado
          com `sidebar-nav.tsx` justamente para os dois não divergirem.

          Chega ao celular de graça: `mobile-sidebar.tsx` renderiza este mesmo
          componente. */}
      <div
        className={cn(
          'border-sidebar-border flex shrink-0 flex-col gap-3 border-t pt-3',
          recolhida && 'w-full items-center',
        )}
      >
        {/* O dialogo de feedback e um botao com texto. Recolhida ele sairia
            cortado — e o rótulo do grupo sairia junto, senão sobraria um
            cabeçalho sem nada embaixo. O `UserMenu` ja tem a variante compacta
            que o `Topbar` usa desde que nasceu. */}
        {!recolhida && (
          <div className="flex flex-col gap-1">
            <TituloDeGrupoDaBarra>Suporte</TituloDeGrupoDaBarra>
            <DialogoDeFeedback />
          </div>
        )}
        <UserMenu
          currentUser={currentUser}
          variant={recolhida ? 'compact' : 'expanded'}
        />
      </div>
    </div>
  )
}
