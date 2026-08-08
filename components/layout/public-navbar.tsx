import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { Logo } from '@/components/branding/logo'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Planos', href: '#planos' },
  { label: 'Dúvidas', href: '#faq' },
]

export function PublicNavbar() {
  return (
    // `backdrop-blur` em header sticky é o pior caso de scroll no mobile: o
    // navegador repinta o backdrop a cada frame e perde o caminho rápido de
    // scroll composto. Fundo sólido abaixo de `md`, blur só no desktop, onde
    // sobra GPU.
    <header className="border-border/60 bg-background md:bg-background/80 sticky top-0 z-50 border-b md:backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/">
          <Logo />
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
