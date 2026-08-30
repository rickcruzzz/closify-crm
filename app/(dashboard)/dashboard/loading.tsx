import { PageHeader } from '@/components/layout/page-header'
import { CABECALHO_DOS_RESULTADOS } from '@/lib/dashboard/cabecalho'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Mesmo cabeçalho da página, da MESMA fonte. Enquanto cada arquivo
          tinha a sua cópia, este aqui ficou dez dias escrevendo
          "Dashboard / Métricas do seu funil de vendas" — o jargão que a
          renomeação de 19/08 tirou do produto —, e toda visita à tela via
          o nome errado antes do certo. */}
      <PageHeader
        title={CABECALHO_DOS_RESULTADOS.titulo}
        description={CABECALHO_DOS_RESULTADOS.descricao}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>

      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
