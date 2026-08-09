import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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
      {/* O logo já leva para a home, mas não se lê como "voltar" — quem entrou
          para consultar um documento precisa de uma saída explícita. Fica no
          layout para valer nas duas páginas de uma vez. */}
      <header className="border-border/50 border-b px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
          {/* `shrink-0` + `whitespace-nowrap`: o logo é largo e, sem isso, o
              rótulo quebraria em duas linhas ou seria comprimido no celular.
              Abaixo de `sm` fica só a seta com rótulo acessível, porque aí o
              espaço é do logo. */}
          <Link
            href="/"
            aria-label="Voltar ao site"
            className="text-muted-foreground hover:text-foreground flex min-h-11 shrink-0 items-center gap-1.5 text-sm whitespace-nowrap transition-colors"
          >
            <ArrowLeft aria-hidden className="size-4" />
            <span className="hidden sm:inline">Voltar ao site</span>
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
