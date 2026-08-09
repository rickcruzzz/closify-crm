import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Criar conta',
  description:
    'Crie sua conta no Velo Funil e comece a organizar seu funil de vendas. Plano gratuito, sem cartão.',
  alternates: { canonical: '/cadastro' },
}

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return children
}
