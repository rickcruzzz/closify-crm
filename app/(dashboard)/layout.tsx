import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { lerEstadoDoOnboarding, precisaDeBoasVindas } from '@/lib/onboarding/estado'

// Tudo aqui dentro é área logada: nada deve ser indexado. As páginas filhas
// só sobrescrevem o title; este robots vale para todas.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [{ user, workspaceId, workspaces }, estadoOnboarding] = await Promise.all([
    getCurrentUserAndWorkspace(),
    lerEstadoDoOnboarding(),
  ])

  if (workspaces.length === 0) {
    redirect('/onboarding')
  }

  // Mesma regra que vivia no middleware, movida para cá: quem nunca
  // configurou nada passa pelas boas-vindas antes do produto. Rodar em
  // paralelo com `getCurrentUserAndWorkspace`, e não em série antes dele,
  // é o que tira a ida extra da navegação.
  if (precisaDeBoasVindas(estadoOnboarding)) {
    redirect('/bem-vindo')
  }

  const currentUser = {
    name: (user.user_metadata?.name as string | undefined) ?? user.email ?? 'Usuário',
    email: user.email ?? '',
    initials: ((user.user_metadata?.name as string | undefined) ?? user.email ?? 'U')
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  }

  return (
    // O TooltipProvider fica aqui, e não no layout raiz: só a área logada usa
    // tooltip, então a landing não carrega o JS do provider à toa.
    <TooltipProvider delay={200}>
      <div className="flex min-h-dvh">
        <Sidebar workspaces={workspaces} activeWorkspaceId={workspaceId} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar workspaces={workspaces} activeWorkspaceId={workspaceId} currentUser={currentUser} />
          <main id="conteudo" className="flex-1 p-4 md:p-6">
          {/* Largura máxima no conteúdo, não no `main`: o `main` continua
              ocupando a tela para o fundo não cortar, e o miolo centraliza.
              1160px é a faixa em que um formulário de duas colunas ainda se lê
              sem o olho atravessar o monitor inteiro.

              O Kanban rola na horizontal por conta própria e é a exceção — ele
              passa por cima com `max-w-none`. */}
          <div className="mx-auto w-full max-w-[1160px]">
            {children}
          </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
