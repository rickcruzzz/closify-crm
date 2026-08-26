import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceMembers } from '@/lib/leads/queries'
import { getTasksAbertas } from '@/lib/tasks/queries'
import { COOKIE_ESCOPO, resolverEscopo } from '@/lib/tasks/escopo'
import { lerSinaisDeAtivacao } from '@/lib/onboarding/sinais'
import { HojeClient } from '@/components/tasks/hoje-client'

export const metadata: Metadata = { title: 'Hoje' }

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ escopo?: string }>
}) {
  const [params, jar, { user, workspaceId }] = await Promise.all([
    searchParams,
    cookies(),
    getCurrentUserAndWorkspace(),
  ])

  // "Minhas" é o padrão de quem nunca escolheu, e continua sendo: admin que
  // abre a tela e vê 40 tarefas de outras pessoas não tem o que fazer com
  // elas. A tela responde "o que EU faço agora".
  //
  // Mas depois de a pessoa escolher, a escolha PRECISA sobreviver. O item
  // "Hoje" da barra lateral aponta para `/hoje` sem parâmetro, então quem
  // escolhia "Da equipe", ia ao Funil e voltava pelo menu encontrava "Minhas"
  // de volta sem ter clicado em nada. Ver `lib/tasks/escopo.ts`.
  const escopo = resolverEscopo(params.escopo, jar.get(COOKIE_ESCOPO)?.value)

  // `lerSinaisDeAtivacao` reusado do checklist: são três `count` com
  // `head: true`, sem trazer linha, e roda em paralelo com o resto. Serve para
  // a tela vazia distinguir "você está em dia" de "você ainda não começou",
  // que são coisas opostas e mostravam a mesma mensagem de parabéns.
  const [tasks, members, sinais] = await Promise.all([
    getTasksAbertas(workspaceId, escopo === 'equipe' ? null : user.id),
    getWorkspaceMembers(workspaceId),
    lerSinaisDeAtivacao(workspaceId),
  ])

  return (
    <HojeClient
      tasks={tasks}
      members={members}
      currentUserId={user.id}
      escopo={escopo}
      temNegocio={sinais.negocios > 0}
      temLead={sinais.leads > 0}
    />
  )
}
