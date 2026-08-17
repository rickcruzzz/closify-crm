import { Inbox, SearchX } from 'lucide-react'

// Estado por coluna: 6 colunas na tela ao mesmo tempo, então fica compacto de
// propósito, sem título/descrição/CTA, que poluiriam o board vazio.
export function EmptyColumnState({ filtered = false }: { filtered?: boolean }) {
  const Icon = filtered ? SearchX : Inbox

  return (
    <div className="text-muted-foreground flex flex-col items-center gap-1.5 rounded-lg border border-dashed p-4 text-center text-xs">
      <Icon aria-hidden className="size-4" />
      {filtered ? 'Nada com esse filtro' : 'Nenhum negócio nesta etapa'}
    </div>
  )
}
