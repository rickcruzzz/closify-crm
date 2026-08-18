'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { cn } from '@/lib/utils'
import { navGroups } from '@/lib/nav-items'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const abaAtual = searchParams.get('aba')

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-4">
      {navGroups.map((group, indiceDoGrupo) => (
        <div key={group.title ?? `grupo-${indiceDoGrupo}`} className="flex flex-col gap-1">
          {group.title && (
            <span className="text-muted-foreground px-2.5 text-xs font-semibold tracking-wide uppercase">
              {group.title}
            </span>
          )}

          {group.items.map((item) => {
            const rotaDoItem = item.href.split('?')[0]!
            const mesmaRota = pathname === rotaDoItem || pathname.startsWith(`${rotaDoItem}/`)

            // "Preferências", "Equipe" e "Integrações" apontam pras três pro
            // mesmo `/settings`, o que diferencia qual fica destacada é a
            // aba na URL, não a rota. "Equipe"/"Integrações" acendem só na
            // própria aba; "Preferências" acende em QUALQUER outra aba
            // (empresa/plano), que não têm entrada própria no menu, por isso
            // não é uma comparação direta de igualdade, e sim "não é a aba
            // de alguém mais".
            //
            // O `if` precisa ser sobre a rota DESTE item, não sobre a página
            // atual: comparar com `pathname` direto acendia TODO item do
            // menu sempre que a pessoa estivesse em `/settings`, porque a
            // condição nunca checava se o item em questão era um dos três de
            // `/settings`.
            const active =
              rotaDoItem === '/settings'
                ? mesmaRota &&
                  (item.aba ? abaAtual === item.aba : abaAtual !== 'equipe' && abaAtual !== 'integracoes')
                : mesmaRota

            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors',
                  // Ativo ganha margin negativo + padding maior na mesma
                  // proporção (-4px / +4px): a pill fica 8px mais larga (mais
                  // respiro do fundo colorido em volta do ícone), mas o
                  // ícone continua exatamente na mesma posição horizontal do
                  // item inativo, padding e margin se cancelam.
                  active
                    ? '-mx-1 bg-primary px-3.5 text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground px-2.5',
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {item.title}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
