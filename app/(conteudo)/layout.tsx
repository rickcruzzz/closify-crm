import { PublicNavbar } from '@/components/layout/public-navbar'
import { PublicFooter } from '@/components/landing/public-footer'

/**
 * Layout das páginas de conteúdo.
 *
 * Diferente do `(legal)`: ali quem chega veio consultar um documento e a
 * navbar seria ruído. Aqui quem chega veio de uma busca sem conhecer o
 * produto, e a navbar é a única forma de ele descobrir que existe um.
 *
 * A largura curta é a mesma, e pela mesma razão: linha longa de texto corrido
 * cansa, o alvo é 65 a 75 caracteres.
 */
export default function ConteudoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNavbar />
      <main id="conteudo" className="flex-1 px-4 py-12 md:px-6 md:py-16">
        <article className="mx-auto max-w-3xl">{children}</article>
      </main>
      <PublicFooter />
    </div>
  )
}
