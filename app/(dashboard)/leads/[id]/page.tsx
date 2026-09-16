import { notFound } from 'next/navigation'

import { getLeadById, getWorkspaceMembers } from '@/lib/leads/queries'
import { getTasksDoLead } from '@/lib/tasks/queries'
import { getNegociosAbertosDoLead } from '@/lib/deals/queries'
import { getIntegrationConnections } from '@/lib/integrations/queries'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { LeadDetailClient } from '@/components/leads/lead-detail-client'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  // Quem pode corrigir atividade: o autor dela ou um admin. A action refaz
  // essa checagem no servidor, aqui é só para não exibir um menu de ações
  // que resultaria em erro.
  const [
    result,
    members,
    tasks,
    { data: isAdmin },
    integracoes,
    negociosAbertos,
    { data: temPro },
  ] = await Promise.all([
      getLeadById(workspaceId, id),
      getWorkspaceMembers(workspaceId),
      getTasksDoLead(workspaceId, id),
      supabase.rpc('is_workspace_admin', { target_workspace_id: workspaceId }),
      getIntegrationConnections(workspaceId),
      // Entra no MESMO `Promise.all`: encadear seria mais uma ida de rede em
      // série até São Paulo, na página que a pessoa mais abre depois do funil.
      getNegociosAbertosDoLead(workspaceId, id),
      // A FUNCAO, nunca a coluna `plan`: ela e o ultimo valor gravado e nao
      // sabe que o tempo passou. Regra de plano le `pro_vigente`, e isso esta
      // travado como decisao desde a 0027.
      supabase.rpc('pro_vigente', { target_workspace_id: workspaceId }),
    ])
  if (!result) {
    notFound()
  }

  // Mostrado no diálogo de "Enviar e-mail" como "De: <e-mail>" — sem isso a
  // pessoa não sabe qual conta Gmail vai aparecer como remetente até o
  // e-mail já ter saído.
  const remetenteGmail =
    integracoes.find((c) => c.provider === 'gmail' && c.status === 'connected')?.accountLabel ??
    null

  return (
    <LeadDetailClient
      lead={result.lead}
      activities={result.activities}
      tasks={tasks}
      members={members}
      currentUserId={user.id}
      isAdmin={!!isAdmin}
      remetenteGmail={remetenteGmail}
      temPro={!!temPro}
      negociosAbertos={negociosAbertos}
    />
  )
}
