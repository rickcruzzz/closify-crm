import { Skeleton } from '@/components/ui/skeleton'

/**
 * O esqueleto dos destaques.
 *
 * A leitura em si é barata (um JSON), mas a página monta 21 miniaturas de
 * Story, cada uma servida por uma rota que lê do disco. Sem sinal entre o
 * clique e a primeira imagem, a tela fica em branco e parece travada — a
 * mesma queixa que este projeto já pagou duas vezes.
 */
export default function CarregandoDestaques() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-3xl" />
      </div>

      {[0, 1].map((bloco) => (
        <div key={bloco} className="flex flex-col gap-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-[9/16] w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
