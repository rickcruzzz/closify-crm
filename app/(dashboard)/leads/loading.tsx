import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { CABECALHOS } from '@/lib/telas/cabecalhos'

export default function LeadsLoading() {
  return (
    <div>
      <PageHeader {...CABECALHOS.leads} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-9 max-w-sm flex-1" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="ring-foreground/10 flex flex-col gap-1 overflow-hidden rounded-xl ring-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-none" />
        ))}
      </div>
    </div>
  )
}
