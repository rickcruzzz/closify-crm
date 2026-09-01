import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { CABECALHOS } from '@/lib/telas/cabecalhos'

/**
 * O esqueleto de Conversas.
 *
 * Cabeçalho REAL, com texto de verdade: ele não depende de dado nenhum, e
 * trocá-lo por barra cinza faria a tela piscar de "carregando" para "carregado"
 * numa parte que nunca muda. Mesmo padrão de `/hoje/loading.tsx`.
 *
 * O esqueleto imita a forma da tela — lista à esquerda, conversa no meio —
 * para o conteúdo real não pular quando chegar.
 */
export default function CarregandoConversas() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader {...CABECALHOS.conversas} />

      <div className="border-border/60 flex h-[calc(100vh-11rem)] overflow-hidden rounded-xl border">
        <div className="border-border/60 flex w-full flex-col border-r md:w-80 lg:w-96">
          <div className="border-border/60 flex items-center justify-between border-b px-4 py-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>

          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="border-border/60 flex flex-col gap-2 border-b px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>

        <div className="hidden flex-1 md:block" />
      </div>
    </div>
  )
}
