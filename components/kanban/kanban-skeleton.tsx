import { dealStageLabels, dealStages } from '@/lib/deals/types'
import { Skeleton } from '@/components/ui/skeleton'

export function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {dealStages.map((stage) => (
        <div key={stage} className="w-72 shrink-0">
          <div className="text-muted-foreground mb-3 text-sm font-medium">
            {dealStageLabels[stage]}
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}
