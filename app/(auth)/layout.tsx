import Link from 'next/link'
import { KanbanSquare } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <KanbanSquare className="size-4" />
        </div>
        Closify
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
