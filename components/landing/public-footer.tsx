import Link from 'next/link'

import { Logo } from '@/components/branding/logo'

const footerLinks = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Planos', href: '#planos' },
  { label: 'Entrar', href: '/login' },
  { label: 'Começar grátis', href: '/cadastro' },
]

export function PublicFooter() {
  return (
    <footer className="border-border/50 border-t px-4 py-10 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Logo />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="text-muted-foreground text-xs">
          © {new Date().getFullYear()} Closify. Todos os direitos reservados.
        </span>
      </div>
    </footer>
  )
}
