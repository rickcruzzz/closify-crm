import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

const stages = [
  'Novo Lead',
  'Contato Realizado',
  'Proposta Enviada',
  'Negociação',
  'Fechado Ganho',
  'Fechado Perdido',
]

export default function KanbanPage() {
  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Acompanhe seus negócios em cada etapa do funil."
      />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage} className="w-72 shrink-0">
            <div className="text-muted-foreground mb-2 text-sm font-medium">{stage}</div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
