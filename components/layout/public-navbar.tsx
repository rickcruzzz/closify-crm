import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Planos', href: '#planos' },
]

export function PublicNavbar() {
  return (
    <header className="border-border/50 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">Closify</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
          >
            Entrar
          </Link>
          <Link href="/cadastro" className={cn(buttonVariants())}>
            Começar grátis
          </Link>
        </div>
      </div>
    </header>
  )
}
