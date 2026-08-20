'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BellRing, Images, LayoutDashboard, Megaphone } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A navegação da Central.
 *
 * ## Por que links de verdade, e não abas
 *
 * Cada seção é uma rota própria (`<Link>` do Next), não uma aba que troca
 * estado. Três ganhos concretos: o botão voltar do navegador funciona, dá para
 * deixar `/dono/alertas` num favorito e abrir direto, e cada página carrega só
 * o que ela precisa — a de alertas não paga a consulta do Meta Ads.
 *
 * Também evita reviver a queixa das abas de Configurações, que pareciam
 * travadas por não darem sinal entre o clique e o conteúdo novo. Aqui a barra
 * de progresso nativa do navegador cobre isso de graça.
 */
const SECOES = [
  { href: '/dono', rotulo: 'Visão geral', icone: LayoutDashboard },
  { href: '/dono/alertas', rotulo: 'Alertas', icone: BellRing },
  { href: '/dono/anuncio', rotulo: 'Anúncio', icone: Megaphone },
  { href: '/dono/criativos', rotulo: 'Criativos', icone: Images },
] as const

export function Navegacao({ alertas }: { alertas?: number }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Seções da Central"
      className="border-border/60 -mb-px flex gap-1 overflow-x-auto border-b"
    >
      {SECOES.map((secao) => {
        // Comparação exata: `/dono` é prefixo de todas as outras, e
        // `startsWith` deixaria a Visão geral marcada como ativa em todas.
        const ativa = pathname === secao.href
        const Icone = secao.icone

        return (
          <Link
            key={secao.href}
            href={secao.href}
            aria-current={ativa ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
              ativa
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            <Icone aria-hidden className="size-4" />
            {secao.rotulo}
            {/* O contador só aparece quando há o que cobrar. Um "0" permanente
                vira ruído e ensina o olho a ignorar justamente o lugar onde o
                problema vai aparecer — mesma regra do contador da barra
                lateral do produto. */}
            {secao.href === '/dono/alertas' && alertas ? (
              <span className="rounded-full bg-red-500/15 px-1.5 text-xs font-semibold text-red-500 tabular-nums">
                {alertas}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
