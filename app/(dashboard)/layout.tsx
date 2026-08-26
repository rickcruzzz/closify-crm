import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { situacaoDoPlanoDaEmpresaAtiva } from '@/lib/plans/trial-queries'
import { AvisoDeTrial } from '@/components/layout/aviso-de-trial'
import { lerEstadoDoOnboarding, precisaDeBoasVindas } from '@/lib/onboarding/estado'
import { contarTarefasDoDiaDoUsuario } from '@/lib/tasks/queries'
import { contarConversasEsperandoDoUsuario } from '@/lib/conversas/queries'

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
  // As três na MESMA onda, apesar de a contagem precisar do `workspaceId`.
  // `contarTarefasDoDiaDoUsuario` chama `getCurrentUserAndWorkspace()` por
  // dentro, e ela é `cache()` do React: a segunda chamada devolve a MESMA
  // promise da primeira, sem nova ida ao Supabase Auth. Então o custo total é
  // `max(onboarding, auth + contagem)` e não a soma dos três em fila.
  //
  // Fazer `await` do bloco acima e só então contar acrescentaria uma ida de
  // rede a TODA navegação — precisamente o defeito que já custou caro aqui e
  // está registrado em `docs/estado-atual.md` (196ms por consulta, vezes 8-10
  // por navegação). Um badge não vale isso.
  const [
    { user, workspaceId, workspaces },
    estadoOnboarding,
    tarefasDoDia,
    conversasEsperando,
    situacaoDoPlano,
  ] =
    await Promise.all([
      getCurrentUserAndWorkspace(),
      lerEstadoDoOnboarding(),
      contarTarefasDoDiaDoUsuario(),
      // Mesma onda, mesmo motivo: `count: exact, head: true`, o banco devolve
      // o numero e nao as linhas. Contador que custa uma ida de rede por
      // navegacao nao vale o que informa.
      contarConversasEsperandoDoUsuario(),
      // Entra na MESMA onda pelo mesmo motivo da contagem de tarefas: depende
      // do `workspaceId`, mas obtém-no de `getCurrentUserAndWorkspace()`, que é
      // `cache()` — a segunda chamada devolve a promise da primeira, sem nova
      // ida ao Auth. Em série, seria mais uma viagem de rede por navegação.
      situacaoDoPlanoDaEmpresaAtiva(),
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
      {/* `h-dvh overflow-hidden` no lugar de `min-h-dvh`: sem isso, flexbox
          estica o `<aside>` do sidebar pra bater com a altura do CONTEÚDO
          (align-items: stretch é o padrão), e em página comprida (Configurações)
          o sidebar ficava mais alto que a tela, rolar a página rolava ele
          junto, incluindo o rodapé de conta, pra fora de vista. Travando o
          container em UM viewport e movendo o scroll pra dentro da coluna
          principal, o sidebar nunca mais estica além da tela: fica fixo sem
          precisar de `position: sticky`. */}
      <div className="flex h-dvh overflow-hidden">
        <Sidebar
          workspaces={workspaces}
          activeWorkspaceId={workspaceId}
          currentUser={currentUser}
          tarefasDoDia={tarefasDoDia}
            conversasEsperando={conversasEsperando}
        />
        {/* `overflow-x-hidden` explícito ao lado do `overflow-y-auto`: pela
            própria especificação CSS, `overflow-y` diferente de `visible`
            faz o navegador tratar `overflow-x` como `auto` mesmo sem pedir,
            e isso criaria barra de rolagem horizontal por 1px de sombra/foco
            que passasse da borda. Deixar explícito também documenta a
            decisão em vez de depender do cálculo automático do navegador. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <Topbar
            workspaces={workspaces}
            activeWorkspaceId={workspaceId}
            currentUser={currentUser}
            tarefasDoDia={tarefasDoDia}
            conversasEsperando={conversasEsperando}
          />
          {/* Entre a barra e o conteúdo: não empurra a navegação para baixo e
              aparece antes de qualquer tela do produto. Só renderiza algo nos
              últimos 3 dias do trial ou depois que ele acaba — ver
              `AVISAR_A_PARTIR_DE`. */}
          <AvisoDeTrial
            trialAte={workspaces.find((w) => w.id === workspaceId)?.trial_ate ?? null}
            assinaturaAtiva={situacaoDoPlano.temAssinaturaPaga}
          />
          <main id="conteudo" className="flex-1 p-4 md:p-6">
          {/* Largura máxima no conteúdo, não no `main`: o `main` continua
              ocupando a tela para o fundo não cortar, e o miolo centraliza.
              1160px é a faixa em que um formulário de duas colunas ainda se lê
              sem o olho atravessar o monitor inteiro.

              O Kanban rola na horizontal por conta própria e é a exceção, ele
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
