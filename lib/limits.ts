import { createClient } from '@/lib/supabase/server'
import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  FREE_WORKSPACE_LIMIT,
} from '@/lib/plans'

type LimitCheck = { allowed: boolean; reason?: string }

export async function canAddLead(workspaceId: string): Promise<LimitCheck> {
  const supabase = await createClient()

  const { data: pro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })

  if (pro) return { allowed: true }

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

  const { data: pro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })

  if (pro) return null

  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  return Math.max(0, FREE_LEAD_LIMIT - (count ?? 0))
}

export async function canAddMember(workspaceId: string): Promise<LimitCheck> {
  const supabase = await createClient()

  const { data: pro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })

  if (pro) return { allowed: true }

  // Conta membros já ativos + convites pendentes, sem isso, dava pra
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

/**
 * Pode criar mais uma empresa?
 *
 * Diferente dos outros limites, este é POR USUÁRIO, não por workspace: o que
 * se está contendo é justamente a criação de workspaces novos para escapar do
 * teto de colaboradores.
 *
 * A conta é feita sobre workspaces onde a pessoa é ADMIN, participar de uma
 * empresa a convite de outro não deve consumir a vaga dela, senão quem aceita
 * dois convites fica impedido de ter a própria empresa.
 *
 * Quem já passou do limite antes desta regra existir mantém o que criou: a
 * checagem só barra criações novas.
 */
export async function canAddWorkspace(userId: string): Promise<LimitCheck> {
  const supabase = await createClient()

  const { data: vinculos } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)
    .eq('role', 'admin')

  const ids = (vinculos ?? []).map((v) => v.workspace_id)
  if (ids.length === 0) return { allowed: true }

  // Uma empresa Pro libera a criação: o plano é do workspace, e quem paga por
  // qualquer um deles tem direito a multi-empresa.
  //
  // Pergunta por workspace em vez de ler a coluna `plan` em lote: a coluna é o
  // último valor gravado e não sabe que o período pago venceu. `pro_vigente`
  // confere a validade. São poucas chamadas, o Free permite uma empresa, e
  // quem tem várias é justamente quem paga.
  const validades = await Promise.all(
    ids.map((id) => supabase.rpc('pro_vigente', { target_workspace_id: id })),
  )

  const temPro = validades.some(({ data }) => data === true)
  if (temPro) return { allowed: true }

  if (ids.length >= FREE_WORKSPACE_LIMIT) {
    return {
      allowed: false,
      reason: `O plano Free inclui ${FREE_WORKSPACE_LIMIT} empresa. Faça upgrade para o Pro para gerenciar várias.`,
    }
  }

  return { allowed: true }
}
