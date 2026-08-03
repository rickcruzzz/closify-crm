import { dealStages, dealStageLabels } from '@/lib/deals/types'
import { mockDeals } from '@/lib/deals/mock-data'
import { formatCompactBRL } from '@/lib/deals/metrics'
import { stageAccent } from '@/lib/deals/stage-colors'

const stageSummary = dealStages.map((stage) => {
  const deals = mockDeals.filter((deal) => deal.stage === stage)
  return {
    stage,
    label: dealStageLabels[stage],
    count: deals.length,
    value: deals.reduce((sum, deal) => sum + deal.value, 0),
  }
})

const maxCount = Math.max(...stageSummary.map((s) => s.count))
const totalValue = stageSummary.reduce((sum, s) => sum + s.value, 0)

export function PipelinePreviewCard() {
  return (
    <div className="border-border/50 bg-card overflow-hidden rounded-2xl border shadow-2xl">
      <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-amber-500/70" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <span className="text-muted-foreground font-mono text-xs">
          pipeline — workspace: acme-corp
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {stageSummary.map((s) => (
          <div key={s.stage} className="flex items-center gap-3">
            <span className="text-muted-foreground w-28 shrink-0 truncate text-xs font-medium">
              {s.label}
            </span>
            <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${maxCount === 0 ? 0 : (s.count / maxCount) * 100}%`,
                  backgroundColor: stageAccent[s.stage].bar,
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs font-medium whitespace-nowrap">
              {formatCompactBRL(s.value)}
            </span>
            <span className="text-muted-foreground w-5 shrink-0 text-right text-xs">
              {s.count}
            </span>
          </div>
        ))}
      </div>

      <div className="border-border/50 flex items-center justify-between border-t px-4 py-3">
        <span className="text-muted-foreground font-mono text-xs">total pipeline</span>
        <span className="text-sm font-semibold">{formatCompactBRL(totalValue)}</span>
      </div>
    </div>
  )
}
