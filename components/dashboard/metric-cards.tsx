import Link from 'next/link'
import { ArrowRight, Briefcase, DollarSign, Target, Users, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCompactBRL } from '@/lib/deals/metrics'
import { textoDaConversao } from '@/lib/dashboard/conversao'
import { CONTATOS, FUNIL, hrefDaEtapa } from '@/lib/dashboard/destinos'
import type { DashboardMetrics } from '@/lib/dashboard/queries'

type MetricCardConfig = {
  label: string
  icon: LucideIcon
  accent: { text: string; bg: string }
  valor: (metrics: DashboardMetrics) => string
  /**
   * A linha de baixo. Ou informação de verdade (a base do percentual), ou o
   * nome do lugar para onde o card leva.
   */
  rodape: (metrics: DashboardMetrics) => string
  /**
   * Todos os quatro têm destino agora.
   *
   * Antes só dois tinham, e o link era um texto de 12px no rodapé do card —
   * "Negócios abertos" e "Valor no funil" não abriam nada. Um usuário do
   * produto tentou clicar para ver o detalhe e a tela não respondeu.
   */
  href: string
}

// Sem histórico de métricas por período no schema ainda, não há como
// calcular variação real (ex: "+18% vs mês anterior"), mostrar um número
// inventado ao lado de dados reais seria mais enganoso do que não mostrar
// nada. Fica pendente até existir uma tabela de snapshots mensais. A BASE do
// percentual, essa sim, é dado real e entra — ver `lib/dashboard/conversao.ts`.
const cards: MetricCardConfig[] = [
  {
    label: 'Contatos',
    icon: Users,
    accent: {
      text: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-500/10 dark:bg-blue-400/10',
    },
    valor: (metrics) => metrics.totalLeads.toString(),
    rodape: () => 'Ver contatos',
    href: CONTATOS,
  },
  {
    label: 'Negócios abertos',
    icon: Briefcase,
    accent: {
      text: 'text-violet-500 dark:text-violet-400',
      bg: 'bg-violet-500/10 dark:bg-violet-400/10',
    },
    valor: (metrics) => metrics.openDeals.toString(),
    rodape: () => 'Ver no funil',
    href: FUNIL,
  },
  {
    label: 'Valor no funil',
    icon: DollarSign,
    accent: {
      text: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    },
    valor: (metrics) => formatCompactBRL(metrics.pipelineValue),
    rodape: () => 'Ver negócios abertos',
    href: FUNIL,
  },
  {
    label: 'Viraram venda',
    icon: Target,
    accent: {
      text: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
    },
    valor: (metrics) => textoDaConversao(metrics.wonDeals, metrics.closedDeals).valor,
    // A base no lugar do "Ver no funil": o percentual sozinho é o que mente.
    rodape: (metrics) => textoDaConversao(metrics.wonDeals, metrics.closedDeals).base,
    // Não existe tela própria de detalhamento de conversão por período, e o
    // funil já mostra a coluna Fechado Ganho, que é o numerador desse número.
    href: hrefDaEtapa('fechado_ganho'),
  },
]

export function MetricCards({ metrics }: { metrics: DashboardMetrics }) {
  // Workspace sem nenhum lead: quatro zeros não informam nada e ainda dão a
  // impressão de sistema quebrado. Um convite à ação ocupa o mesmo espaço e
  // diz o que fazer. Basta o primeiro lead para os cartões voltarem, e eles
  // voltam com número de verdade, não com zero.
  if (metrics.totalLeads === 0 && metrics.openDeals === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={Target}
            title="Seu funil está pronto"
            description="Cadastre o primeiro contato para começar a acompanhar suas oportunidades. Os números aparecem aqui assim que houver movimento."
          >
            <Button render={<Link href={CONTATOS}>Adicionar primeiro contato</Link>} />
            <Button variant="outline" render={<Link href={FUNIL}>Ver o funil</Link>} />
          </EmptyState>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        // O alvo é o CARD INTEIRO, não o texto do rodapé.
        //
        // A versão anterior punha um `<Link>` de 12px dentro do cartão: para
        // acertar, era preciso mirar numa linha de texto que nem parecia
        // botão. Envolver o cartão dá ~180×100px de alvo, muito acima dos
        // 44px mínimos, e resolve o toque no celular junto.
        <Link
          key={card.label}
          href={card.href}
          className="focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3"
        >
          <Card className="group/metrica hover:bg-accent/40 hover:ring-foreground/20 h-full cursor-pointer transition-colors">
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {card.label}
              </CardTitle>
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  card.accent.bg,
                )}
              >
                <card.icon className={cn('size-4.5', card.accent.text)} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {/* `tabular-nums` porque os quatro números são lidos em linha e
                  comparados entre si: com largura variável de dígito, eles
                  dançam de card para card. */}
              <span className="text-2xl font-semibold tabular-nums">{card.valor(metrics)}</span>
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                {card.rodape(metrics)}
                <ArrowRight
                  aria-hidden
                  className="size-3 transition-transform group-hover/metrica:translate-x-0.5"
                />
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
