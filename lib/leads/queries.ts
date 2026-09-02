import { createClient } from '@/lib/supabase/server'
import type { LeadStatus } from '@/lib/leads/types'

const PAGE_SIZE = 25

export type LeadRow = {
  id: string
  name: string
  /** Nulo quando o lead veio de planilha sem coluna de e-mail. */
  email: string | null
  phone: string | null
  company: string | null
  status: LeadStatus
  value: number
  created_at: string
  owner_id: string | null
  owner_name: string | null
}

export type LeadsPage = {
  leads: LeadRow[]
  nextCursor: string | null
}

// .or() do PostgREST recebe uma string de filtro crua, sem escapar, valores
// vindos do usuário podem injetar operadores extras (ex: ",workspace_id.neq.x")
// e alterar a query lógica além do campo pretendido. Remove os caracteres que
// têm significado sintático no mini-DSL de filtro (, ( ) . * %) antes de
// interpolar; sobra só o texto de busca em si.
function sanitizeForPostgrestFilter(value: string) {
  return value.replace(/[,()."'*%]/g, '').trim()
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(\+\d{2}:\d{2}|Z)$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseCursor(cursor: string): { createdAt: string; id: string } | null {
  const [createdAt, id] = cursor.split('|')
  if (!createdAt || !id || !ISO_TIMESTAMP.test(createdAt) || !UUID.test(id)) {
    return null
  }
  return { createdAt, id }
}

// Paginação cursor-based (created_at + id como tiebreaker) em vez de OFFSET:
// OFFSET obriga o Postgres a escanear e descartar todas as linhas anteriores
// a cada página, custo cresce linearmente com a página. Cursor usa o índice
// existente e tem custo constante independente de quantas páginas já foram
// vistas, o que importa quando um workspace acumula milhares de leads.
export async function getLeadsPage(
  workspaceId: string,
  options: { search?: string; status?: LeadStatus; cursor?: string } = {},
): Promise<LeadsPage> {
  const supabase = await createClient()

  let query = supabase
    .from('leads')
    .select('id, name, email, phone, company, status, value, created_at, owner_id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (options.search) {
    const term = sanitizeForPostgrestFilter(options.search)
    if (term) {
      query = query.or(`name.ilike.%${term}%,company.ilike.%${term}%`)
    }
  }

  if (options.status) {
    query = query.eq('status', options.status)
  }

  if (options.cursor) {
    const parsed = parseCursor(options.cursor)
    if (parsed) {
      query = query.or(
        `created_at.lt.${parsed.createdAt},and(created_at.eq.${parsed.createdAt},id.lt.${parsed.id})`,
      )
    }
  }

  const { data, error } = await query

  if (error || !data) {
    return { leads: [], nextCursor: null }
  }

  const hasMore = data.length > PAGE_SIZE
  const page = hasMore ? data.slice(0, PAGE_SIZE) : data

  const ownerIds = Array.from(
    new Set(page.map((l) => l.owner_id).filter((id): id is string => !!id)),
  )
  const ownerNames = ownerIds.length > 0 ? await getMemberNames(workspaceId, ownerIds) : new Map()

  const leads: LeadRow[] = page.map((lead) => ({
    ...lead,
    owner_name: lead.owner_id ? ownerNames.get(lead.owner_id) ?? null : null,
  }))

  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? `${last.created_at}|${last.id}` : null

  return { leads, nextCursor }
}

export async function getLeadById(workspaceId: string, leadId: string) {
  const supabase = await createClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, name, email, phone, company, status, value, created_at, owner_id')
    .eq('workspace_id', workspaceId)
    .eq('id', leadId)
    .single()

  if (error || !lead) {
    return null
  }

  const ownerNames = lead.owner_id ? await getMemberNames(workspaceId, [lead.owner_id]) : new Map()

  // Teto explicito: o PostgREST corta em 1.000 e NAO avisa, e como isto ordena
  // por `created_at desc` o que sumiria seriam as atividades mais ANTIGAS —
  // justamente o comeco da relacao com o cliente.
  //
  // Hoje nao e alcancavel: a base tem poucas atividades por contato. Mas cada
  // mensagem de WhatsApp vira uma `activity`, entao no dia em que a integracao
  // voltar um cliente ativo chega a 1.000 em meses, e o corte aconteceria em
  // silencio. Achado na auditoria de 02/09, mesma classe do `getBoardDeals`
  // corrigido em 12/08.
  //
  // 200 e o que uma timeline mostra sem virar rolagem infinita. Quem precisar
  // de mais que isso precisa de paginacao, nao de um teto maior.
  const { data: activities } = await supabase
    .from('activities')
    .select('id, type, description, created_at, author_id')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(200)

  const authorIds = Array.from(
    new Set((activities ?? []).map((a) => a.author_id).filter((id): id is string => !!id)),
  )
  const authorNames =
    authorIds.length > 0 ? await getMemberNames(workspaceId, authorIds) : new Map()

  return {
    lead: { ...lead, owner_name: lead.owner_id ? ownerNames.get(lead.owner_id) ?? null : null },
    activities: (activities ?? []).map((a) => ({
      ...a,
      author_name: a.author_id ? authorNames.get(a.author_id) ?? null : null,
    })),
  }
}

export type WorkspaceMember = { id: string; name: string }

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)

  if (!data || data.length === 0) return []

  const names = await getMemberNames(
    workspaceId,
    data.map((m) => m.user_id),
  )

  return data.map((m) => ({ id: m.user_id, name: names.get(m.user_id) ?? 'Sem nome' }))
}

// auth.users não é acessível via PostgREST diretamente (fica fora do schema
// public exposto), usa user_metadata.name já sincronizado no signUp, com
// fallback ao invés de uma query extra. Nomes vêm de uma RPC porque o client
// anon não pode selecionar auth.users, mesmo indiretamente via join.
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
