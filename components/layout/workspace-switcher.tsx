'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronsUpDown, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type WorkspaceSummary = {
  id: string
  name: string
  plan: string
}

export function WorkspaceSwitcher({ workspaces }: { workspaces: WorkspaceSummary[] }) {
  const router = useRouter()
  const [activeId, setActiveId] = React.useState(workspaces[0]?.id)
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0]

  if (!active) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-muted flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-sm transition-colors outline-none">
        <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
          <Building2 className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{active.name}</span>
          <span className="text-muted-foreground text-xs capitalize">{active.plan}</span>
        </div>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => setActiveId(workspace.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">{workspace.name}</span>
            <Badge variant="secondary" className="shrink-0 capitalize">
              {workspace.plan}
            </Badge>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onClick={() => router.push('/onboarding')}>
          <Plus className="size-4" />
          Nova empresa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
