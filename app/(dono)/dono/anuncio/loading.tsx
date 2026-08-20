import { Skeleton } from '@/components/ui/skeleton'

/**
 * O esqueleto do anúncio.
 *
 * Esta é a rota mais lenta da Central por natureza: além do banco, ela fala com
 * a API da Meta, que tem teto de 15 segundos configurado em `meta-ads.ts`.
 * Medido em 1,2s no caminho feliz — e o caminho infeliz (Meta lenta) é
 * exatamente quando o sinal de carregando mais importa.
 *
 * Ver `alertas/loading.tsx` para o porquê de todo `force-dynamic` desta seção
 * precisar de um destes.
 */
export default function CarregandoAnuncio() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>


      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}
