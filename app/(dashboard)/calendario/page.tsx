import type { Metadata } from 'next'

import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceMembers } from '@/lib/leads/queries'
import { getTasksNoIntervalo } from '@/lib/tasks/queries'
import { gradeDoMes } from '@/lib/calendario/grade-do-mes'
import { diaEmSaoPaulo } from '@/lib/tasks/buckets'
import { CalendarioClient } from '@/components/calendario/calendario-client'

export const metadata: Metadata = { title: 'Calendário' }

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>
}) {
  const params = await searchParams
  const { user, workspaceId } = await getCurrentUserAndWorkspace()

  const hoje = diaEmSaoPaulo(new Date())
  const [anoPadrao, mesPadrao] = hoje.split('-').map(Number) as [number, number]

  const ano = params.ano ? Number(params.ano) : anoPadrao
  const mes = params.mes ? Number(params.mes) : mesPadrao

  // Busca a GRADE inteira (42 dias, incluindo o rabo do mês anterior/seguinte
  // que a grade mostra), não só o mês civil: senão os chips dos dias
  // "esmaecidos" no início/fim da grade apareceriam vazios mesmo quando têm
  // tarefa, e a pessoa acharia que a tarefa sumiu.
  const celulas = gradeDoMes(ano, mes)
  const desde = celulas[0]!.dia
  const ate = celulas[celulas.length - 1]!.dia

  const [tasks, members] = await Promise.all([
    getTasksNoIntervalo(workspaceId, `${desde}T00:00:00-03:00`, `${ate}T23:59:59-03:00`),
    getWorkspaceMembers(workspaceId),
  ])

  return (
    <CalendarioClient
      tasks={tasks}
      members={members}
      currentUserId={user.id}
      ano={ano}
      mes={mes}
      desdeCarregado={desde}
      ateCarregado={ate}
    />
  )
}
