'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { navGroups } from '@/lib/nav-items'

export function SidebarNav({
  onNavigate,
  tarefasDoDia,
  conversasEsperando,
  recolhida = false,
}: {
  onNavigate?: () => void
  /** Quantas tarefas minhas vencem hoje ou já venceram — o badge do "Hoje". */
  tarefasDoDia: number
  conversasEsperando: number
  /** Barra em modo icone: o rotulo sai do item e vira tooltip. */
  recolhida?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const abaAtual = searchParams.get('aba')

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-4">
      {navGroups.map((group, indiceDoGrupo) => (
        <div
          key={group.title ?? `grupo-${indiceDoGrupo}`}
          className="flex flex-col gap-1"
        >
          {/* Recolhida, o titulo do grupo vira um FILETE. A palavra
              "CONFIGURACOES" nao cabe em 4,5rem, e abreviar rotulo de secao
              produz sigla que ninguem decifra. O filete preserva o unico
              trabalho que o titulo faz ali: separar um grupo do outro. */}
          {group.title && recolhida && (
            <span aria-hidden className="bg-sidebar-border mx-auto my-1 h-px w-6" />
          )}
          {group.title && !recolhida && (
            <span className="text-muted-foreground px-2.5 text-xs font-semibold tracking-wide uppercase">
              {group.title}
            </span>
          )}

          {group.items.map((item) => {
            const rotaDoItem = item.href.split('?')[0]!
            const mesmaRota =
              pathname === rotaDoItem || pathname.startsWith(`${rotaDoItem}/`)

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
                  (item.aba
                    ? abaAtual === item.aba
                    : abaAtual !== 'equipe' && abaAtual !== 'integracoes')
                : mesmaRota

            const Icon = item.icon

            const link = (
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
                    ? 'bg-primary text-primary-foreground -mx-1 px-3.5'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground px-2.5',
                  // Recolhida o item vira quadrado centrado. `justify-center`
                  // com o texto fora do fluxo e o que evita o icone "pular"
                  // de posicao entre os dois estados.
                  recolhida && 'size-11 justify-center px-0',
                  recolhida && active && 'mx-0 px-0',
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {/* `sr-only` e nao removido: o nome continua sendo o nome
                    acessivel do link. Sem ele o leitor de tela anunciaria
                    "link" e mais nada, e o `aria-label` no `<a>` seria uma
                    segunda copia do titulo para manter em dia. */}
                <span className={cn(recolhida ? 'sr-only' : 'flex-1 truncate')}>
                  {item.title}
                </span>

                {/* O único badge do menu, e só quando há o que cobrar. Um
                    contador que mostra "0" vira ruído permanente: a pessoa
                    aprende a ignorar o lugar onde o número aparece, e aí ele
                    não funciona no dia em que houver algo.

                    `aria-label` completo porque "3" sozinho, lido em
                    sequência com "Hoje", sai como "Hoje 3" — que soa como
                    parte do nome do item, não como uma pendência. */}
                {/* Conversas esperando resposta.
                    Mesma regra do contador de Hoje, e pelo mesmo motivo:
                    aparece só quando há o que cobrar. Um "0" permanente vira
                    paisagem e treina a pessoa a não olhar o lugar — aí ele não
                    funciona no dia em que houver alguém esperando.

                    A cor é a de alerta, não a do primary: aqui o número não é
                    uma pendência do dia, é um cliente parado sem resposta, e
                    40% deles desistem em 10 minutos. */}
                {item.href === '/conversas' && conversasEsperando > 0 && (
                  <span
                    aria-label={`${conversasEsperando} ${conversasEsperando === 1 ? 'conversa esperando' : 'conversas esperando'} resposta`}
                    className={cn(
                      'flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                      active
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-500',
                    )}
                  >
                    {conversasEsperando > 99 ? '99+' : conversasEsperando}
                  </span>
                )}

                {item.href === '/hoje' && tarefasDoDia > 0 && (
                  <span
                    aria-label={`${tarefasDoDia} ${tarefasDoDia === 1 ? 'tarefa' : 'tarefas'} para hoje`}
                    className={cn(
                      'flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                      active
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-primary/15 text-primary',
                    )}
                  >
                    {tarefasDoDia > 99 ? '99+' : tarefasDoDia}
                  </span>
                )}
              </Link>
            )

            // ## O rotulo vira tooltip, e o envelope e um `div`
            //
            // `TooltipTrigger render={<Link/>}` seria o caminho idiomatico do
            // Base UI e e justamente o que este projeto ja pagou em 08/09: no
            // merge de props o `onClick` do elemento de dentro foi DESCARTADO,
            // a aba abria e a acao nunca rodava, sem erro nenhum no console.
            //
            // Com o `div` por fora, o `Link` continua sendo um `Link` comum,
            // com o `onNavigate` intacto; o tooltip ancora no envelope.
            return recolhida ? (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<div />}>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )
          })}
        </div>
      ))}
    </nav>
  )
}
