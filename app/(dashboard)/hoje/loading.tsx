import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CABECALHOS } from '@/lib/telas/cabecalhos'

/**
 * O esqueleto de `/hoje`, no formato da tela real.
 *
 * Dois grupos com quatro linhas, que é o que a maioria vê ao abrir: algumas
 * atrasadas e as de hoje. Esqueleto genérico, três retângulos iguais, faz a
 * tela pular quando o conteúdo chega, e o pulo custa mais atenção do que a
 * espera que ele tentava disfarçar.
 *
 * O cabeçalho é o componente de verdade, com o texto de verdade: ele não
 * depende de dado nenhum, então piscar um retângulo cinza no lugar de "Hoje"
 * seria esconder o que já está pronto.
 */
export default function HojeLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        {...CABECALHOS.hoje}
        className="mb-0"
      />

      <div className="flex flex-col gap-4">
        {[4, 3].map((linhas, grupo) => (
          <Card key={grupo}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col">
                {Array.from({ length: linhas }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 px-2 py-2">
                    <Skeleton className="size-4 shrink-0 rounded-[4px]" />
                    <Skeleton className="size-4 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-8 w-12 shrink-0" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
