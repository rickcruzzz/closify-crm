'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { cn } from '@/lib/utils'
import { navItems } from '@/lib/nav-items'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const abaAtual = searchParams.get('aba')

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1">
      {navItems.map((item) => {
        const rotaDoItem = item.href.split('?')[0]!
        const mesmaRota = pathname === rotaDoItem || pathname.startsWith(`${rotaDoItem}/`)

        // "Configurações" e "Integrações" apontam pras duas pro mesmo
        // `/settings` — o que diferencia qual fica destacada é a aba na URL,
        // não a rota. "Integrações" acende só na própria aba; Configurações
        // acende em QUALQUER outra aba (empresa/equipe/plano), que não têm
        // entrada própria no menu — por isso não é uma comparação direta de
        // igualdade, e sim "não é a aba de alguém mais".
        //
        // O `if` precisa ser sobre a rota DESTE item, não sobre a página
        // atual: comparar com `pathname` direto acendia TODO item do menu
        // (Hoje, Pipeline, Leads, Dashboard) sempre que a pessoa estivesse em
        // `/settings`, porque a condição nunca checava se o item em questão
        // era um dos dois de `/settings`.
        const active =
          rotaDoItem === '/settings'
            ? mesmaRota && (item.aba ? abaAtual === item.aba : abaAtual !== 'integracoes')
            : mesmaRota

        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
