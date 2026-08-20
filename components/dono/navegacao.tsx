'use client'

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { BellRing, Images, LayoutDashboard, Loader2, Megaphone } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A navegação da Central.
 *
 * ## Por que `router.push` dentro de `useTransition`, e não `<Link>` puro
 *
 * Três das quatro rotas são `force-dynamic` e falam com serviços externos antes
 * de renderizar. Medido em 20/08: Alertas leva **1,7s** (banco + Asaas +
 * Resend), Anúncio 1,2s (banco + Meta). Com `<Link>` puro, o Next segura a
 * navegação até o servidor responder e a tela fica **exatamente igual** durante
 * todo esse tempo — o clique parece não ter funcionado, e a pessoa clica de novo.
 *
 * Foi exatamente essa a queixa que o projeto já pagou nas abas de Configurações
 * e no seletor de empresa, e a correção é a mesma: `useTransition` acende o
 * sinal no tique seguinte ao clique, antes de qualquer resposta do servidor.
 *
 * Os `loading.tsx` de cada rota resolvem a outra metade (o corpo da página);
 * este componente resolve a primeira — saber QUAL item foi clicado enquanto o
 * conteúdo ainda não chegou.
 *
 * ## Por que continua sendo `<a>` de verdade
 *
 * O elemento continua sendo âncora com `href` real: abrir em nova aba, copiar
 * endereço e o botão voltar seguem funcionando. O `preventDefault` só entra no
 * clique simples — clique com Ctrl, Shift ou botão do meio passa direto para o
 * navegador, como deve.
 */
const SECOES = [
  { href: '/dono', rotulo: 'Visão geral', icone: LayoutDashboard },
  { href: '/dono/alertas', rotulo: 'Alertas', icone: BellRing },
  { href: '/dono/anuncio', rotulo: 'Anúncio', icone: Megaphone },
  { href: '/dono/criativos', rotulo: 'Criativos', icone: Images },
] as const

export function Navegacao({ alertas }: { alertas?: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const [indo, setIndo] = React.useState<string | null>(null)
  const [, startTransition] = React.useTransition()

  // A troca real de `pathname` é o sinal de que a navegação terminou — apaga o
  // pendente nesse momento, não num temporizador que erraria para os dois lados.
  React.useEffect(() => {
    setIndo(null)
  }, [pathname])

  function navegar(evento: React.MouseEvent<HTMLAnchorElement>, href: string) {
    // Clique com modificador ou botão do meio é intenção de abrir noutro lugar:
    // deixa o navegador cuidar.
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return
    if (evento.button !== 0) return

    evento.preventDefault()
    if (href === pathname) return

    setIndo(href)
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <nav
      aria-label="Seções da Central"
      className="border-border/60 -mb-px flex gap-1 overflow-x-auto border-b"
    >
      {SECOES.map((secao) => {
        // Comparação exata: `/dono` é prefixo de todas as outras, e
        // `startsWith` deixaria a Visão geral marcada como ativa em todas.
        const ativa = pathname === secao.href
        const carregando = indo === secao.href
        const Icone = secao.icone

        return (
          <a
            key={secao.href}
            href={secao.href}
            onClick={(e) => navegar(e, secao.href)}
            aria-current={ativa ? 'page' : undefined}
            aria-busy={carregando || undefined}
            className={cn(
              'focus-visible:ring-ring/50 flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
              ativa
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
              // Enquanto uma navegação está em voo, os outros itens esmaecem:
              // deixa claro qual foi clicado sem precisar ler o spinner.
              indo && !carregando && 'opacity-50',
            )}
          >
            {carregando ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Icone aria-hidden className="size-4" />
            )}
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
          </a>
        )
      })}
    </nav>
  )
}
