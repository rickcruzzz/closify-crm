import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  /** Botões da página. Empilham abaixo do título no mobile. */
  actions?: React.ReactNode
  className?: string
}) {
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
        <h1 className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-1 truncate text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-2 text-sm text-pretty">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-3 flex shrink-0 flex-wrap gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
