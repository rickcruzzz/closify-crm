import Link from 'next/link'

import { Logo } from '@/components/branding/logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      {/* Usa o componente de marca em vez de remontar o lockup à mão: esta
          tela tinha uma cópia com o ícone KanbanSquare do lucide, então quem
          fazia login via um símbolo diferente do resto do app. */}
      <Link href="/">
        <Logo />
      </Link>
      <main id="conteudo" className="w-full max-w-sm">
        {children}
      </main>
    </div>
  )
}
