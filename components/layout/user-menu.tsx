'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { ChevronsUpDown, LogOut, Settings, User } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/supabase/actions'

export type CurrentUser = {
  name: string
  email: string
  initials: string
}

/**
 * `compact`: só o avatar redondo — usado no topbar, onde a barra é estreita
 * e o nome/e-mail já não cabem.
 *
 * `expanded`: avatar + nome + e-mail + seta, no mesmo estilo do
 * `WorkspaceSwitcher` logo acima dele no sidebar — usado no rodapé fixo,
 * onde tem largura de sobra e a informação vale mostrar sem precisar abrir
 * o menu primeiro.
 */
export function UserMenu({
  currentUser,
  variant = 'compact',
}: {
  currentUser: CurrentUser
  variant?: 'compact' | 'expanded'
}) {
  const [, startTransition] = useTransition()

  return (
    <DropdownMenu>
      {variant === 'expanded' ? (
        <DropdownMenuTrigger className="hover:bg-muted flex w-full min-w-0 items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm transition-colors outline-none">
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-xs font-medium">{currentUser.initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <span className="truncate font-medium">{currentUser.name}</span>
            <span className="text-muted-foreground truncate text-xs">{currentUser.email}</span>
          </div>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className="rounded-full outline-none">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs font-medium">{currentUser.initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={variant === 'expanded' ? 'start' : 'end'} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-1.5 py-1.5">
            <span className="text-foreground text-sm font-medium">{currentUser.name}</span>
            <span className="text-muted-foreground text-xs font-normal">{currentUser.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* `render` em vez de `onClick` + `router.push`: assim o item vira uma
            âncora de verdade, que abre em nova aba com clique do meio e é
            anunciada como link por leitor de tela.

            Destinos separados pelo dono do dado: `/perfil` é da pessoa (nome,
            e-mail, senha), `/settings` é da empresa (workspace, colaboradores,
            plano). Antes os dois apontavam para cá porque não existia página de
            perfil — o menu oferecia dois caminhos e entregava um. */}
        <DropdownMenuItem className="gap-2" render={<Link href="/perfil" />}>
          <User className="size-4" />
          Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" render={<Link href="/settings" />}>
          <Settings className="size-4" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="gap-2"
          onClick={() => {
            startTransition(async () => {
              await signOut()
            })
          }}
        >
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
