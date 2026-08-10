'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { LogOut, Settings, User } from 'lucide-react'

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

export function UserMenu({ currentUser }: { currentUser: CurrentUser }) {
  const [, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs font-medium">{currentUser.initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
