import type { Metadata } from 'next'

// page.tsx é client component (react-hook-form), e client component não pode
// exportar metadata, daí este layout só para o título da aba.
export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse o painel do seu workspace no Velo Funil.',
  // ## Canonical, porque esta rota tem MAIS de um endereco valido
  //
  // O middleware manda para ca com `?next=`, `?erro=` e `?convite=` conforme
  // o caso, e o Google trata cada variacao como pagina propria — diluindo o
  // sinal entre copias do mesmo conteudo.
  //
  // Achado em 03/09 por `scripts/marketing/auditar-descoberta.mjs`, que le o
  // HTML servido. Era a unica pagina do sitemap sem canonical.
  alternates: { canonical: '/login' },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
