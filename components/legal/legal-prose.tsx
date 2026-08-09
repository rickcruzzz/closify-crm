import { cn } from '@/lib/utils'

/**
 * Tipografia dos documentos legais.
 *
 * Componentes locais em vez do plugin de prose do Tailwind: são cinco
 * elementos, e a dependência traria um conjunto de estilos que teria de ser
 * sobrescrito para respeitar os tokens de tema do app.
 */

export function LegalTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mb-2 text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
      {children}
    </h1>
  )
}

export function LegalUpdatedAt({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mb-10 text-sm">{children}</p>
}

export function LegalSection({
  id,
  titulo,
  children,
}: {
  id?: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-8 scroll-mt-24">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{titulo}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

export function LegalP({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn('text-muted-foreground leading-relaxed', className)}>{children}</p>
  )
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 leading-relaxed">
      {children}
    </ul>
  )
}

/** Tabela com scroll próprio: em 375px uma tabela de 4 colunas não cabe. */
export function LegalTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="ring-border overflow-x-auto rounded-lg ring-1">
      <table className="w-full min-w-[34rem] text-left text-sm">{children}</table>
    </div>
  )
}
