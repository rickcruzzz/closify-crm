import type { Metadata } from 'next'

// page.tsx é client component (react-hook-form), e client component não pode
// exportar metadata — daí este layout só para o título da aba.
export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse o painel do seu workspace no Closify CRM.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
