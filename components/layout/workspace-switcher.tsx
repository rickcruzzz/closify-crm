'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronsUpDown, Plus, Zap } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { FREE_WORKSPACE_LIMIT } from '@/lib/plans'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

  // Espelha `canAddWorkspace` no servidor: uma empresa Pro libera multi-empresa,
  // e quem já passou do limite antes da regra existir continua enxergando as
  // que criou — só não cria mais. Isto é conveniência de interface; quem
  // decide de verdade é a RPC no banco.
  const temPro = workspaces.some((w) => w.plan === 'pro')
  const podeCriarEmpresa = temPro || workspaces.length < FREE_WORKSPACE_LIMIT

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
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        </DropdownMenuGroup>
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
        {/* No Free o limite é de uma empresa. Mostrar "Nova empresa" para quem
            não pode criar leva a pessoa a preencher o formulário inteiro e só
            então tomar o erro — melhor dizer o motivo aqui e mandar direto
            para a comparação de planos. */}
        {podeCriarEmpresa ? (
          <DropdownMenuItem className="gap-2" onClick={() => router.push('/onboarding')}>
            <Plus className="size-4" />
            Nova empresa
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="gap-2"
            onClick={() => router.push('/settings/billing')}
          >
            <Zap className="size-4" />
            <span className="flex flex-col">
              <span>Nova empresa</span>
              <span className="text-muted-foreground text-xs">
                Disponível no plano Pro
              </span>
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
