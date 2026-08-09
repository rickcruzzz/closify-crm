import { createClient } from '@/lib/supabase/server'
import { FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT } from '@/lib/plans'

type LimitCheck = { allowed: boolean; reason?: string }

export async function canAddLead(workspaceId: string): Promise<LimitCheck> {
  const supabase = await createClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .single()

  if (workspace?.plan === 'pro') return { allowed: true }

  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  if ((count ?? 0) >= FREE_LEAD_LIMIT) {
    return {
      allowed: false,
      reason: `Plano Free permite no máximo ${FREE_LEAD_LIMIT} leads. Faça upgrade para o Pro para continuar.`,
    }
  }

  return { allowed: true }
}

// A importação por CSV grava várias linhas de uma vez, então `canAddLead`
// (que só responde sim/não para UMA linha) deixaria passar um arquivo de 300
// leads num workspace Free com 1 vaga sobrando. Devolve quantas cabem;
// `null` significa sem teto (plano Pro).
export async function remainingLeadSlots(workspaceId: string): Promise<number | null> {
  const supabase = await createClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .single()

  if (workspace?.plan === 'pro') return null

  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  return Math.max(0, FREE_LEAD_LIMIT - (count ?? 0))
}

export async function canAddMember(workspaceId: string): Promise<LimitCheck> {
  const supabase = await createClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .single()

  if (workspace?.plan === 'pro') return { allowed: true }

  // Conta membros já ativos + convites pendentes — sem isso, dava pra
  // estourar o limite mandando vários convites de uma vez e todos aceitando
  // depois.
  const [{ count: memberCount }, { count: pendingInvites }] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
    supabase
      .from('workspace_invites')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending'),
  ])

  if ((memberCount ?? 0) + (pendingInvites ?? 0) >= FREE_MEMBER_LIMIT) {
    return {
      allowed: false,
      reason: `Plano Free permite no máximo ${FREE_MEMBER_LIMIT} membros. Faça upgrade para o Pro para convidar mais.`,
    }
  }

  return { allowed: true }
}
