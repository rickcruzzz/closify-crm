'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Filter } from 'lucide-react'

import { useMediaQuery } from '@/hooks/use-media-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { FunnelStageCount } from '@/lib/dashboard/queries'
import { stageAccent } from '@/lib/deals/stage-colors'
import { FUNIL, hrefDaEtapa } from '@/lib/dashboard/destinos'

function FunnelTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: FunnelStageCount }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]!.payload
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 rounded-lg px-3 py-2 text-xs ring-1">
      <p className="font-medium">{item.label}</p>
      <p className="text-muted-foreground">
        {item.count} {item.count === 1 ? 'negócio' : 'negócios'}
        {item.count > 0 && ' · clique para abrir'}
      </p>
    </div>
  )
}

export function FunnelChart({ data }: { data: FunnelStageCount[] }) {
  const router = useRouter()

  // Sem isso o Recharts desenha um grid com eixos zerados, que parece gráfico
  // quebrado em vez de "ainda não há dados".
  const isEmpty = data.every((stage) => stage.count === 0)

  // O eixo Y do Recharts só aceita largura fixa em px. Com 130px sobrava
  // menos de metade da tela para as barras em 375px, então o eixo encolhe no
  // mobile, os rótulos truncam, mas o gráfico volta a ser legível.
  const isCompact = useMediaQuery('(max-width: 639px)')

  /**
   * Abre a etapa no funil.
   *
   * O gráfico era o alvo mais óbvio da tela e o único que não respondia a
   * clique nenhum: a pessoa via "Proposta Enviada" com três negócios e não
   * tinha como chegar neles. Etapa vazia não navega — mandar alguém para uma
   * coluna sem nada dentro é outro beco.
   */
  function abrirEtapa(stage: FunnelStageCount) {
    if (stage.count === 0) return
    router.push(hrefDaEtapa(stage.stage))
  }

  // O rótulo do eixo é o alvo grande e alcançável por teclado. A barra é
  // clicável também, mas SVG fino não é alvo de toque e não entra no Tab
  // sozinho.
  const porRotulo = new Map(data.map((d) => [d.label, d]))

  function TickDaEtapa({
    x,
    y,
    payload,
  }: {
    x?: number
    y?: number
    payload?: { value: string }
  }) {
    const stage = payload ? porRotulo.get(payload.value) : undefined
    const clicavel = !!stage && stage.count > 0

    return (
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fill="var(--muted-foreground)"
        fontSize={12}
        role={clicavel ? 'link' : undefined}
        tabIndex={clicavel ? 0 : undefined}
        style={clicavel ? { cursor: 'pointer' } : undefined}
        className={clicavel ? 'hover:fill-foreground focus-visible:fill-foreground' : undefined}
        onClick={() => stage && abrirEtapa(stage)}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault()
            if (stage) abrirEtapa(stage)
          }
        }}
      >
        {payload?.value}
      </text>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de negócios</CardTitle>
        <CardDescription>Clique numa etapa para abrir os negócios dela.</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-64 items-center justify-center sm:h-72">
            <EmptyState
              icon={Filter}
              title="Funil ainda vazio"
              description="Crie negócios no funil para ver quantos estão em cada etapa."
            >
              <Button variant="outline" render={<Link href={FUNIL}>Criar negócio</Link>} />
            </EmptyState>
          </div>
        ) : (
          <div className="h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                // `right: 36` abre espaço para o número no fim da barra: com
                // a margem antiga ele era cortado na etapa mais cheia.
                margin={{ left: isCompact ? 0 : 8, right: 36 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={isCompact ? 96 : 130}
                  // 12px é o piso de legibilidade. O eixo já perde largura no
                  // mobile; encolher a fonte junto tornava os rótulos das
                  // etapas difíceis de ler justamente onde a tela é menor.
                  tick={<TickDaEtapa />}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'var(--muted)' }} />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={28}
                  onClick={(entrada: unknown) => abrirEtapa(entrada as FunnelStageCount)}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.stage}
                      fill={stageAccent[entry.stage].bar}
                      cursor={entry.count > 0 ? 'pointer' : 'default'}
                    />
                  ))}
                  {/* O número ao lado da barra, e não só no tooltip.
                      Este gráfico entra no PDF do "Exportar relatório"
                      (`ReportArea` envolve os três painéis), e **no PDF não
                      existe hover**: até agora o relatório que o cliente
                      recebia saía com barras sem nenhum valor legível. */}
                  <LabelList
                    dataKey="count"
                    position="right"
                    fill="var(--muted-foreground)"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
