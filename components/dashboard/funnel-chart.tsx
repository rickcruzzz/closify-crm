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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de negócios</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
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
                width={130}
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
      </CardContent>
    </Card>
  )
}
