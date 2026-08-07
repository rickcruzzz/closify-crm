import Link from 'next/link'
import { KanbanSquare } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold tracking-tight"
      >
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <KanbanSquare aria-hidden className="size-4" />
        </div>
        Closify
      </Link>
      <main id="conteudo" className="w-full max-w-sm">
        {children}
      </main>
    </div>
  )
}
