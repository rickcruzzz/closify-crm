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
        {/* `min-h-11` em vez de só texto: um link de 20px de altura é um alvo
            de toque ruim no polegar, e abaixo do mínimo de 24px da WCAG 2.2.
            O `-my-2` mantém o espaçamento visual original. */}
        <nav className="-my-2 flex flex-wrap items-center justify-center gap-x-6">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center text-sm transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} Closify. Todos os direitos reservados.
        </span>
      </div>
    </footer>
  )
}
