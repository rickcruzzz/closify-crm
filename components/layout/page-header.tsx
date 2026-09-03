import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  /**
   * Texto de apoio, ou um espaço reservado.
   *
   * Aceita `ReactNode` e não só `string` por causa de uma tela: em
   * `/settings` a descrição depende da ABA, que vem de `searchParams` — e
   * `loading.tsx` não recebe `searchParams` no App Router. O esqueleto não
   * tem como saber qual frase virá, então ele passa um `Skeleton` daqui em
   * vez de afirmar a de uma aba qualquer.
   */
  description?: React.ReactNode
  /** Botões da página. Empilham abaixo do título no mobile. */
  actions?: React.ReactNode
  className?: string
}) {
  // `<p>` só quando o conteúdo é texto de verdade. Um `Skeleton` é um `<div>`,
  // e `<p><div/></p>` é HTML inválido — o navegador fecha o parágrafo antes da
  // div e o resultado é um `<p>` vazio com a div solta ao lado.
  const Descricao = typeof description === 'string' ? 'p' : 'div'
  return (
    // O cabeçalho de toda tela do produto entra com o mesmo movimento das
    // telas de login: `duration-entrada` com `delay-passo-*` crescente, os
    // tokens definidos em `globals.css`.
    //
    // Por que aqui e não em cada página: `PageHeader` é o topo de todas as
    // nove telas, então uma mudança neste arquivo dá ritmo ao produto inteiro
    // — e garante que ele seja o MESMO ritmo em todas, em vez de nove
    // aproximações escritas à mão que divergem na primeira manutenção.
    //
    // Só `opacity` e `transform`, que o navegador compõe na GPU sem recalcular
    // layout — é o que sustenta 60fps num cabeçalho que aparece a cada
    // navegação. Deslocamento curto (8px): o conteúdo abaixo não é animado, e
    // um percurso longo aqui faria o cabeçalho parecer solto do resto.
    //
    // `prefers-reduced-motion` já é respeitado pelo bloco global do
    // `globals.css`, que zera duração e atraso com `!important`.
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="animate-entrada fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-1 truncate text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <Descricao className="text-muted-foreground animate-entrada fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-2 text-sm text-pretty">
            {description}
          </Descricao>
        )}
      </div>

      {actions && (
        <div className="animate-entrada fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-3 flex shrink-0 flex-wrap gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
