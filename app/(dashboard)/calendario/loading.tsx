import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * O esqueleto de `/calendario`, no formato de grade de mês — o modo padrão no
 * desktop. Mesma lógica de `/hoje/loading.tsx`: formato real, não retângulo
 * genérico, para o conteúdo chegando não fazer a tela pular.
 */
export default function CalendarioLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendário"
        description="O que aconteceu e o que vem por aí, tudo num lugar."
        className="mb-0"
      />

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="bg-card flex min-h-24 flex-col gap-1 p-2">
            <Skeleton className="h-4 w-5" />
            {i % 5 === 0 && <Skeleton className="h-4 w-full" />}
          </div>
        ))}
      </div>
    </div>
  )
}
