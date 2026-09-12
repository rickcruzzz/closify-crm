'use client'

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  BellRing,
  Brain,
  Filter,
  Bookmark,
  Images,
  Handshake,
  LayoutDashboard,
  Loader2,
  Megaphone,
  MessageSquareText,
  Radar,
} from 'lucide-react'

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
  // Depois de Alertas e antes de Ativação: as duas falam de gente usando o
  // produto, mas em prazos diferentes. Esta é acionável HOJE — cada linha é uma
  // pessoa dentro dos sete dias de trial, com o WhatsApp a um clique. O funil
  // agregado da tela seguinte orienta o mês.
  { href: '/dono/trial', rotulo: 'Decidindo', icone: Handshake },
  // Logo depois de Decidindo, e pelo mesmo criterio: as duas sao fila de
  // trabalho de HOJE, com o WhatsApp a um clique. A diferenca e de onde vem a
  // pessoa — Decidindo sao os que ja entraram no produto e tem sete dias
  // correndo; esta sao os que ainda nao ouviram falar dele. Nesta ordem porque
  // quem ja esta testando esta mais perto de pagar que quem nunca viu a tela.
  { href: '/dono/prospeccao', rotulo: 'Prospeccao', icone: Radar },
  // Colada em Prospeccao porque responde a pergunta que a outra tela nao
  // respondia: o que exatamente vai sair. O texto so aparecia dentro do
  // `wa.me`, depois do clique — tarde demais para revisar.
  { href: '/dono/mensagens', rotulo: 'Mensagens', icone: MessageSquareText },
  // Fecha o trio da prospeccao, e nesta ordem de proposito: Prospeccao e quem
  // abordar, Mensagens e o que vai sair, Inteligencia e o que VOLTOU. Ela vem
  // por ultimo porque so tem o que dizer depois que as outras duas rodaram — e
  // porque ate 12/09 nao existia resposta nenhuma para ler.
  { href: '/dono/inteligencia', rotulo: 'Inteligência', icone: Brain },
  // Logo depois de Alertas e Decidindo, e pelo mesmo critério de rotina: as
  // três são acionáveis HOJE. Alertas é o que o sistema detectou sozinho; esta
  // é o que o cliente DISSE — e é a única fonte de "por quê" que este produto
  // tem. Ativação, logo abaixo, diz onde as pessoas param; só o relato diz o
  // motivo.
  { href: '/dono/suporte', rotulo: 'Suporte', icone: MessageSquareText },
  // Depois de Alertas e antes de Anúncio de propósito: a ordem é a da rotina —
  // primeiro o que quebrou, depois se as pessoas estão usando, e só então
  // quanto custa trazer mais gente. Olhar anúncio antes de ativação é comprar
  // tráfego para um funil que talvez esteja furado.
  { href: '/dono/ativacao', rotulo: 'Ativação', icone: Filter },
  { href: '/dono/anuncio', rotulo: 'Anúncio', icone: Megaphone },
  { href: '/dono/criativos', rotulo: 'Criativos', icone: Images },
  // Depois de Criativos, e separado dela: aquela tela CONFERE peça antes de
  // virar anúncio (proporção, resolução, posicionamento do Meta); esta entrega
  // Story já pronto, e a única pergunta aqui é em que ordem subir.
  { href: '/dono/destaques', rotulo: 'Destaques', icone: Bookmark },
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
