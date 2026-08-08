'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Link from 'next/link'
import { Filter } from 'lucide-react'

import { useMediaQuery } from '@/hooks/use-media-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { FunnelStageCount } from '@/lib/dashboard/queries'
import { stageAccent } from '@/lib/deals/stage-colors'

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
      </p>
    </div>
  )
}

export function FunnelChart({ data }: { data: FunnelStageCount[] }) {
  // Sem isso o Recharts desenha um grid com eixos zerados, que parece gráfico
  // quebrado em vez de "ainda não há dados".
  const isEmpty = data.every((stage) => stage.count === 0)

  // O eixo Y do Recharts só aceita largura fixa em px. Com 130px sobrava
  // menos de metade da tela para as barras em 375px, então o eixo encolhe no
  // mobile — os rótulos truncam, mas o gráfico volta a ser legível.
  const isCompact = useMediaQuery('(max-width: 639px)')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de negócios</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-64 items-center justify-center sm:h-72">
            <EmptyState
              icon={Filter}
              title="Funil ainda vazio"
              description="Crie negócios no pipeline para visualizar a distribuição por etapa."
            >
              <Button
                variant="outline"
                render={<Link href="/kanban">Criar negócio</Link>}
              />
            </EmptyState>
          </div>
        ) : (
          <div className="h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: isCompact ? 0 : 8, right: 16 }}
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
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {data.map((entry) => (
                    <Cell key={entry.stage} fill={stageAccent[entry.stage].bar} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
