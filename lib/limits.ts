import { createClient } from '@/lib/supabase/server'

export const FREE_LEAD_LIMIT = 50
export const FREE_MEMBER_LIMIT = 2
export const PRO_PLAN_PRICE = 49
export const FREE_PLAN_PRICE = 0

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
