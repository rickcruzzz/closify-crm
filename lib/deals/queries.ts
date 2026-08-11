import { createClient } from '@/lib/supabase/server'
import type { DealStage } from '@/lib/deals/types'

export type DealRow = {
  id: string
  title: string
  lead_id: string | null
  value: number
  stage: DealStage
  due_date: string | null
  created_at: string
  owner_id: string | null
  owner_name: string | null
}

export type DealLeadRow = {
  id: string
  name: string
  /** Nulo quando o lead veio de planilha sem coluna de e-mail. */
  email: string | null
  company: string | null
  phone: string | null
}

// Kanban carrega o board inteiro de uma vez (sem paginação) porque o
// dnd-kit precisa de todos os itens em memória para o drag-and-drop
// funcionar entre colunas — paginação faria sentido só se um workspace
// acumulasse milhares de deals abertos simultaneamente, o que não é o
// padrão de uso (deals fechados não ficam void aberto no board).
export async function getBoardDeals(workspaceId: string): Promise<DealRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deals')
    .select('id, title, lead_id, value, stage, due_date, created_at, owner_id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const ownerIds = Array.from(new Set(data.map((d) => d.owner_id).filter((id): id is string => !!id)))
  const ownerNames = ownerIds.length > 0 ? await getMemberNames(workspaceId, ownerIds) : new Map()

  return data.map((deal) => ({
    ...deal,
    owner_name: deal.owner_id ? ownerNames.get(deal.owner_id) ?? null : null,
  }))
}

export async function getWorkspaceLeadsForSelect(workspaceId: string): Promise<DealLeadRow[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('leads')
    .select('id, name, email, company, phone')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })

  return data ?? []
}

async function getMemberNames(
  workspaceId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_workspace_member_names', {
    target_workspace_id: workspaceId,
    target_user_ids: userIds,
  })

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.user_id, row.name)
  }
  return map
}
