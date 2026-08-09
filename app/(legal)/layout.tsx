import Link from 'next/link'

import { Logo } from '@/components/branding/logo'
import { PublicFooter } from '@/components/landing/public-footer'

/**
 * Layout das páginas legais. Sem navbar de produto de propósito: quem chega
 * aqui veio ler um documento, não converter. Largura curta (`max-w-3xl`)
 * porque linha longa de texto corrido cansa — o alvo é 65-75 caracteres.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border/50 border-b px-4 py-4 md:px-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
        </div>
      </header>

      <main id="conteudo" className="flex-1 px-4 py-12 md:px-6">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>

      <PublicFooter />
    </div>
  )
}
