import { Skeleton } from '@/components/ui/skeleton'

/**
 * O esqueleto espelha o layout real (cabeçalho, quatro números, tabela) em vez
 * de um spinner genérico: quando o desenho do vazio bate com o desenho do
 * cheio, a troca não empurra nada de lugar.
 *
 * Esta tela fala com quatro serviços externos, então a espera é real e visível
 * — mais razão para ela ter forma em vez de um giro no meio da tela.
 */
export default function CarregandoCentral() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <Skeleton className="h-96" />
    </div>
  )
}
