import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { CABECALHOS } from '@/lib/telas/cabecalhos'

export default function KanbanLoading() {
  return (
    <div>
      <PageHeader {...CABECALHOS.kanban} />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex w-72 shrink-0 flex-col gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
