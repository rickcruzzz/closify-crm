'use client'

import * as React from 'react'
import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SidebarContent } from '@/components/layout/sidebar-content'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'
import type { CurrentUser } from '@/components/layout/user-menu'
import type { DecisaoDeNovaEmpresa } from '@/lib/plans/multi-empresa'

export function MobileSidebar({
  workspaces,
  activeWorkspaceId,
  currentUser,
  tarefasDoDia,
  conversasEsperando,
  novaEmpresa,
  temMax,
}: {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  currentUser: CurrentUser
  tarefasDoDia: number
  conversasEsperando: number
  /** Se pode criar outra empresa, decidido no servidor. */
  novaEmpresa: DecisaoDeNovaEmpresa
  temMax: boolean
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Abrir menu" className="md:hidden">
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <SidebarContent
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          currentUser={currentUser}
          tarefasDoDia={tarefasDoDia}
          conversasEsperando={conversasEsperando}
          novaEmpresa={novaEmpresa}
          temMax={temMax}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
