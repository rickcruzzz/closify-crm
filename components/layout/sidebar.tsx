'use client'

import * as React from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { SidebarContent } from '@/components/layout/sidebar-content'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'
import type { CurrentUser } from '@/components/layout/user-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DecisaoDeNovaEmpresa } from '@/lib/plans/multi-empresa'
import { cn } from '@/lib/utils'

/** O nome do cookie, num lugar só para o servidor e o cliente não divergirem. */
export const COOKIE_DA_BARRA = 'barra_recolhida'

/**
 * A barra lateral do desktop, com os dois estados.
 *
 * ## Por que o estado inicial vem do SERVIDOR
 *
 * `localStorage` só existe depois da hidratação: a barra nasceria expandida e
 * pularia para recolhida no primeiro quadro, em toda navegação. Cookie o
 * servidor lê ANTES de renderizar, então o HTML já sai com a largura certa.
 *
 * O layout já é dinâmico (ele autentica), então ler mais um cookie não custa
 * renderização estática nenhuma.
 *
 * ## E por que o estado também vive no cliente
 *
 * Só com cookie, cada clique no botão exigiria uma volta ao servidor para a
 * largura mudar. O `useState` faz a animação acontecer no mesmo quadro do
 * clique; o cookie existe para a PRÓXIMA visita, não para esta.
 *
 * ## O mobile não participa
 *
 * Abaixo de `md` esta `<aside>` não renderiza, e `mobile-sidebar.tsx` mostra o
 * mesmo `SidebarContent` dentro de um `Sheet`. Recolher uma gaveta que já abre
 * e fecha não significa nada, então o botão nem aparece lá.
 */
export function Sidebar({
  workspaces,
  activeWorkspaceId,
  currentUser,
  tarefasDoDia,
  conversasEsperando,
  novaEmpresa,
  temMax,
  recolhidaInicial = false,
}: {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  currentUser: CurrentUser
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
  temMax: boolean
  /** Lido do cookie no layout. Ver o comentário acima. */
  recolhidaInicial?: boolean
}) {
  const [recolhida, setRecolhida] = React.useState(recolhidaInicial)

  function alternar() {
    const nova = !recolhida
    setRecolhida(nova)
    // `max-age` de um ano e `path=/`: a escolha vale para o produto inteiro e
    // não deve expirar junto com a sessão. `SameSite=Lax` porque ela não tem
    // nada a ver com requisição de terceiro.
    document.cookie = `${COOKIE_DA_BARRA}=${nova ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax`
  }

  return (
    <aside
      data-recolhida={recolhida ? '' : undefined}
      className={cn(
        'bg-sidebar border-sidebar-border relative hidden shrink-0 border-r md:block',
        // A transição é só da largura. `motion-reduce` desliga: o guia do
        // projeto exige respeitar `prefers-reduced-motion`, e largura animando
        // arrasta o conteúdo inteiro junto, que é o pior caso para quem sente
        // enjoo com movimento.
        'transition-[width] duration-200 motion-reduce:transition-none',
        recolhida ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <SidebarContent
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        currentUser={currentUser}
        tarefasDoDia={tarefasDoDia}
        conversasEsperando={conversasEsperando}
        novaEmpresa={novaEmpresa}
          temMax={temMax}
        recolhida={recolhida}
      />

      {/* Na BORDA, não dentro da lista: recolhido, qualquer botão dentro da
          coluna disputa espaço com os ícones de navegação. Na borda ele fica
          no mesmo lugar nos dois estados, que é o que faz a pessoa reencontrá-lo
          sem procurar. */}
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={alternar}
          aria-label={recolhida ? 'Expandir a barra lateral' : 'Recolher a barra lateral'}
          aria-expanded={!recolhida}
          className={cn(
            'bg-sidebar border-sidebar-border text-muted-foreground absolute top-16 -right-3.5 z-10 grid size-7 place-items-center rounded-full border shadow-sm transition-colors outline-none',
            // Estados visiveis. Sem o `hover:border`, o botao so mudava de cor
            // do icone e o circulo ficava morto sob o cursor.
            'hover:border-primary/40 hover:text-foreground hover:bg-accent',
            'focus-visible:ring-ring/50 focus-visible:ring-3',
            // ## O alvo de toque e MAIOR que o circulo
            //
            // O desenho pede um botao discreto na borda; a WCAG 2.2 pede 24px
            // e o guia do projeto pede 44 no toque. Os dois so convivem
            // separando o que se VE do que se CLICA.
            //
            // `after` com `-inset-2` leva a area clicavel a 44px sem crescer um
            // pixel do circulo. E o mesmo recurso que `password-field.tsx` usa
            // nos botoes dentro do campo de senha, pela mesma razao: la o campo
            // tem 44px e dois controles desse tamanho comeriam a area de
            // digitar.
            'after:absolute after:-inset-2 after:content-[""]',
          )}
        >
          {recolhida ? (
            <PanelLeftOpen aria-hidden className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden className="size-4" />
          )}
        </TooltipTrigger>
        <TooltipContent side="right">
          {recolhida ? 'Expandir a barra' : 'Recolher a barra'}
        </TooltipContent>
      </Tooltip>
    </aside>
  )
}
