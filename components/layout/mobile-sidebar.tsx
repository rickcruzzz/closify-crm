'use client'

import * as React from 'react'
import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SidebarContent } from '@/components/layout/sidebar-content'
import type { WorkspaceSummary } from '@/components/layout/workspace-switcher'

export function MobileSidebar({ workspaces, activeWorkspaceId }: { workspaces: WorkspaceSummary[]
  activeWorkspaceId: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abrir menu"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <SidebarContent workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
