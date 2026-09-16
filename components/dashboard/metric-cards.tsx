import Link from 'next/link'
import {
  ArrowRight,
  Briefcase,
  DollarSign,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCompactBRL } from '@/lib/deals/metrics'
import { textoDaConversao } from '@/lib/dashboard/conversao'
import { compararComAnterior, type UnidadeDaVariacao } from '@/lib/dashboard/variacao'
import { CONTATOS, FUNIL, hrefDaEtapa } from '@/lib/dashboard/destinos'
import type { DashboardMetrics } from '@/lib/dashboard/queries'

type MetricCardConfig = {
  label: string
  icon: LucideIcon
  accent: { text: string; bg: string }
  valor: (metrics: DashboardMetrics) => string
  /** A linha de baixo. Ou a base do percentual, ou o nome do destino. */
  rodape: (metrics: DashboardMetrics) => string
  href: string
  /**
   * O número que a comparação usa, e em que unidade ele deve ser lido.
   *
   * `null` desliga a comparação para aquele card. Conversão sai em PONTOS
   * porque ela já é um percentual: de 40% para 50% são dez pontos e um
   * crescimento de 25%, e misturar os dois é a mentira que
   * `lib/dashboard/variacao.ts` existe para recusar.
   */
  comparavel: {
    extrair: (m: DashboardMetrics) => number
    unidade: UnidadeDaVariacao
  } | null
}

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
    comparavel: { extrair: (m) => m.totalLeads, unidade: 'percentual' },
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
    comparavel: { extrair: (m) => m.openDeals, unidade: 'percentual' },
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
    comparavel: { extrair: (m) => m.pipelineValue, unidade: 'percentual' },
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
    href: hrefDaEtapa('fechado_ganho'),
    comparavel: {
      // Recalculado dos crus dos DOIS lados, e não do texto: `textoDaConversao`
      // devolve "-" quando nada foi fechado, e comparar strings daria NaN.
      extrair: (m) => (m.closedDeals > 0 ? (m.wonDeals / m.closedDeals) * 100 : 0),
      unidade: 'pontos',
    },
  },
]

export function MetricCards({
  metrics,
  anteriores = null,
  temFiltroDePeriodo = false,
}: {
  metrics: DashboardMetrics
  /**
   * As mesmas métricas na janela imediatamente anterior, ou `null`.
   *
   * `null` quando não há período escolhido — o anterior a "todo o período" é
   * vazio, e toda métrica subiria infinito por cima de zero. Sem isto, o card
   * mostra só o número, que é o comportamento de antes de 16/09.
   */
  anteriores?: DashboardMetrics | null
  /**
   * Há um período escolhido? `false` significa "todo o histórico".
   *
   * ## O defeito que isto fecha, e ele saía no PDF do cliente
   *
   * A condição era só `totalLeads === 0 && openDeals === 0`, e as métricas são
   * recortadas por `created_at` dentro do período (migration 0036). Uma empresa
   * com 200 contatos que clicasse em "Hoje" recebia a tela de conta nova
   * mandando "cadastrar o primeiro contato".
   *
   * E o pior não era a tela: estes cartões ficam DENTRO de `<ReportArea>`, então
   * a frase entrava no PDF que a pessoa manda ao cliente dela.
   */
  temFiltroDePeriodo?: boolean
}) {
  if (metrics.totalLeads === 0 && metrics.openDeals === 0 && !temFiltroDePeriodo) {
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

  if (metrics.totalLeads === 0 && metrics.openDeals === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={Target}
            title="Nada neste período"
            description="Nenhum contato ou negócio foi criado no intervalo escolhido. Seus dados continuam aqui, escolha outro período para vê-los."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const variacao =
          anteriores && card.comparavel
            ? compararComAnterior(
                card.comparavel.extrair(metrics),
                card.comparavel.extrair(anteriores),
                card.comparavel.unidade,
              )
            : null

        return (
          // O alvo é o CARD INTEIRO, não o texto do rodapé: a versão anterior
          // punha um `<Link>` de 12px dentro do cartão, e para acertar era
          // preciso mirar numa linha de texto que nem parecia botão.
          <Link
            key={card.label}
            href={card.href}
            className="focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3"
          >
            <Card className="group/metrica hover:bg-accent/40 hover:ring-foreground/20 h-full cursor-pointer transition-colors motion-reduce:transition-none">
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
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {/* `tabular-nums` porque os quatro números são lidos em linha
                      e comparados entre si: com largura variável de dígito,
                      eles dançam de card para card.
                      3xl e não 2xl: o número é o único dado do cartão, e a
                      distância tipográfica para o rótulo de 14px é o que faz a
                      leitura acontecer em um golpe de vista. */}
                  <span className="text-3xl leading-none font-semibold tabular-nums">
                    {card.valor(metrics)}
                  </span>
                  {variacao && <SeloDeVariacao variacao={variacao} />}
                </div>
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  {card.rodape(metrics)}
                  <ArrowRight
                    aria-hidden
                    className="size-3 transition-transform group-hover/metrica:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
                {variacao && (
                  <span className="text-muted-foreground text-xs">
                    vs. período anterior
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

/**
 * O selo de variação.
 *
 * Cor semântica e não a da marca: verde e vermelho aqui querem dizer "melhor" e
 * "pior", e o teal é identidade — usá-lo para bem-estar faria a marca significar
 * "positivo" e perder o próprio papel.
 *
 * Estável é CINZA e com traço, não verde: ficar igual não é vitória.
 */
function SeloDeVariacao({
  variacao,
}: {
  variacao: { texto: string; direcao: 'subiu' | 'desceu' | 'estavel' }
}) {
  const Icone =
    variacao.direcao === 'subiu'
      ? TrendingUp
      : variacao.direcao === 'desceu'
        ? TrendingDown
        : Minus

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
        variacao.direcao === 'subiu' && 'bg-success/10 text-success',
        variacao.direcao === 'desceu' && 'bg-destructive/10 text-destructive',
        variacao.direcao === 'estavel' && 'bg-muted text-muted-foreground',
      )}
    >
      <Icone aria-hidden className="size-3" />
      {variacao.texto}
    </span>
  )
}
