import { createClient } from '@/lib/supabase/server'
import type { ProximaAcaoRow, TaskRow } from '@/lib/tasks/types'

/**
 * Teto de tarefas lidas de uma vez pela tela /hoje.
 *
 * Não é paginação: quem tem mais de 500 tarefas abertas atribuídas a si não
 * tem uma lista, tem um problema, e cortar aqui evita que a tela cresça sem
 * limite. O teto do banco é 5.000 por empresa (0029); este é por leitura.
 */
const MAX_TAREFAS = 500

type LinhaCrua = {
  id: string
  title: string
  type: TaskRow['type']
  due_at: string
  done_at: string | null
  lead_id: string | null
  deal_id: string | null
  assignee_id: string | null
}

/**
 * Resolve nome de lead e de responsável de uma vez, para a lista inteira.
 *
 * Duas consultas fixas, não uma por linha. E os nomes de membro saem da RPC
 * `get_workspace_member_names`, que é a mesma usada pelos leads e pelo
 * dashboard, `auth.users` não é legível pela RLS do app, então não dá para
 * fazer join com ela.
 */
async function enriquecer(
  workspaceId: string,
  linhas: LinhaCrua[],
): Promise<TaskRow[]> {
  if (linhas.length === 0) return []

  const supabase = await createClient()

  const leadIds = Array.from(
    new Set(linhas.map((l) => l.lead_id).filter((id): id is string => !!id)),
  )
  const userIds = Array.from(
    new Set(linhas.map((l) => l.assignee_id).filter((id): id is string => !!id)),
  )

  const [leadsResult, nomesResult] = await Promise.all([
    leadIds.length > 0
      ? supabase.from('leads').select('id, name').in('id', leadIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    userIds.length > 0
      ? supabase.rpc('get_workspace_member_names', {
          target_workspace_id: workspaceId,
          target_user_ids: userIds,
        })
      : Promise.resolve({ data: [] as { user_id: string; name: string }[] }),
  ])

  const nomeDoLead = new Map((leadsResult.data ?? []).map((l) => [l.id, l.name]))
  const nomeDoMembro = new Map((nomesResult.data ?? []).map((m) => [m.user_id, m.name]))

  return linhas.map((l) => ({
    ...l,
    lead_name: l.lead_id ? nomeDoLead.get(l.lead_id) ?? null : null,
    assignee_name: l.assignee_id ? nomeDoMembro.get(l.assignee_id) ?? null : null,
  }))
}

/**
 * As tarefas abertas da tela /hoje.
 *
 * `assigneeId` nulo traz as da empresa inteira, é o filtro "da equipe". O
 * padrão da tela é "minhas", porque admin que abre e vê 40 tarefas de outra
 * pessoa não sabe o que fazer com elas.
 */
export async function getTasksAbertas(
  workspaceId: string,
  assigneeId: string | null,
): Promise<TaskRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select('id, title, type, due_at, done_at, lead_id, deal_id, assignee_id')
    .eq('workspace_id', workspaceId)
    .is('done_at', null)
    .order('due_at', { ascending: true })
    .limit(MAX_TAREFAS)

  if (assigneeId) {
    query = query.eq('assignee_id', assigneeId)
  }

  const { data, error } = await query

  // Erro silencioso aqui devolveria uma tela vazia idêntica à de quem não tem
  // tarefa nenhuma, e a pessoa acharia que o sistema perdeu o trabalho dela.
  if (error) {
    console.error('getTasksAbertas falhou', error)
    return []
  }

  return enriquecer(workspaceId, data ?? [])
}

/** As tarefas de um lead, abertas e concluídas, para o bloco da página dele. */
export async function getTasksDoLead(
  workspaceId: string,
  leadId: string,
): Promise<TaskRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, type, due_at, done_at, lead_id, deal_id, assignee_id')
    .eq('workspace_id', workspaceId)
    .eq('lead_id', leadId)
    .order('done_at', { ascending: true, nullsFirst: true })
    .order('due_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('getTasksDoLead falhou', error)
    return []
  }

  return enriquecer(workspaceId, data ?? [])
}

/**
 * A próxima ação de cada negócio, para os cards do Kanban.
 *
 * UMA consulta para o board inteiro, não uma por card. O /kanban já carrega
 * todos os negócios abertos sem paginar (medido em 99 KB por abertura); somar
 * uma consulta por card ali multiplicaria o problema em vez de custar uma
 * leitura a mais.
 *
 * Vem ordenada por prazo crescente e o primeiro de cada negócio vence, o
 * `Map` só grava quem chega primeiro. O índice parcial
 * `tasks_proxima_acao_do_negocio_idx` é exatamente esta consulta.
 */
export async function getProximaAcaoPorNegocio(
  workspaceId: string,
): Promise<Map<string, ProximaAcaoRow>> {
  const supabase = await createClient()

  // Cinco colunas, não as oito de `TaskRow`. Medido em produção com 100
  // negócios: 198 B por negócio contra 315 B, e a consulta de negócios que
  // já existia custa 292 B, então o `select` cheio mais que DOBRARIA o peso
  // da rota mais pesada do produto. `done_at` e `lead_id` sairiam sempre
  // iguais (o filtro garante), e o card não mostra responsável.
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, type, due_at, deal_id')
    .eq('workspace_id', workspaceId)
    .is('done_at', null)
    .not('deal_id', 'is', null)
    .order('due_at', { ascending: true })
    .limit(MAX_TAREFAS)

  if (error) {
    console.error('getProximaAcaoPorNegocio falhou', error)
    return new Map()
  }

  const proxima = new Map<string, ProximaAcaoRow>()

  for (const linha of data ?? []) {
    if (!linha.deal_id || proxima.has(linha.deal_id)) continue
    proxima.set(linha.deal_id, linha)
  }

  return proxima
}
