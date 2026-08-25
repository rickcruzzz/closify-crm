import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { fimDoDiaEmSaoPaulo } from '@/lib/tasks/buckets'
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
      // `phone` junto do nome, na consulta que ja existe: e o que permite o
      // botao de responder direto na tarefa, sem uma segunda ida ao banco.
      // Sem ele, "Responder no WhatsApp" e uma ordem sem o meio de cumpri-la —
      // a pessoa teria que sair da tela, achar o contato e abrir para so entao
      // ter o link.
      ? supabase.from('leads').select('id, name, phone').in('id', leadIds)
      : Promise.resolve({ data: [] as { id: string; name: string; phone: string | null }[] }),
    userIds.length > 0
      ? supabase.rpc('get_workspace_member_names', {
          target_workspace_id: workspaceId,
          target_user_ids: userIds,
        })
      : Promise.resolve({ data: [] as { user_id: string; name: string }[] }),
  ])

  const nomeDoLead = new Map((leadsResult.data ?? []).map((l) => [l.id, l.name]))
  const telefoneDoLead = new Map((leadsResult.data ?? []).map((l) => [l.id, l.phone ?? null]))
  const nomeDoMembro = new Map((nomesResult.data ?? []).map((m) => [m.user_id, m.name]))

  return linhas.map((l) => ({
    ...l,
    lead_name: l.lead_id ? nomeDoLead.get(l.lead_id) ?? null : null,
    lead_phone: l.lead_id ? telefoneDoLead.get(l.lead_id) ?? null : null,
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

/**
 * Quantas tarefas MINHAS já venceram ou vencem hoje — o número do menu.
 *
 * Existe para a sidebar dizer, sem a pessoa abrir nada, se há trabalho
 * esperando. Um menu que nunca muda é um menu que ninguém relê; este número é
 * o que traz alguém de volta ao "Hoje" no meio do dia.
 *
 * `count: 'exact', head: true` traz só o número, sem linha nenhuma — isto roda
 * no layout, ou seja, em TODA navegação, e trazer as linhas aqui pagaria o
 * custo de `getTasksAbertas` de novo em cada tela só para exibir um badge. É o
 * mesmo padrão de agregação no banco que `getUsoDasIntegracoes` e a contagem
 * de membros já usam.
 *
 * Só as próprias, nunca as da equipe: o badge cobra ação de quem está olhando,
 * e um número que inclui tarefa de outra pessoa cobra o que não é seu.
 *
 * O corte é o fim do dia em São Paulo, e não `new Date()`, porque a pergunta
 * do badge é "tenho algo hoje?", não "tenho algo neste minuto?" — às 9h uma
 * tarefa marcada para as 17h ainda conta, e é justamente ela que a pessoa
 * precisa lembrar.
 */
export async function contarTarefasDoDiaDoUsuario(): Promise<number> {
  // Resolve a sessão por dentro em vez de receber ids por parâmetro, para
  // poder entrar no MESMO `Promise.all` do layout que já busca a sessão:
  // `getCurrentUserAndWorkspace` é `cache()`, então esta chamada devolve a
  // promise que a outra já criou, sem segunda ida ao Supabase Auth.
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  return contarTarefasDoDia(workspaceId, user.id)
}

export async function contarTarefasDoDia(
  workspaceId: string,
  assigneeId: string,
): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('assignee_id', assigneeId)
    .is('done_at', null)
    .lte('due_at', fimDoDiaEmSaoPaulo(new Date()))

  // Badge é informação secundária: se a contagem falhar, o menu continua
  // funcionando sem ele. Derrubar a navegação inteira por causa de um número
  // seria pior do que não mostrar o número.
  if (error) {
    console.error('contarTarefasDoDia falhou', error)
    return 0
  }

  return count ?? 0
}

/**
 * As tarefas com prazo dentro de um intervalo, para o Calendário.
 *
 * Diferente de `getTasksAbertas`: SEM `is('done_at', null)`, porque o
 * calendário precisa mostrar o que já foi concluído no mês, não só o
 * pendente — é a diferença entre "o que falta fazer" (tela /hoje) e "o que
 * aconteceu e vai acontecer neste período" (calendário).
 */
export async function getTasksNoIntervalo(
  workspaceId: string,
  desde: string,
  ate: string,
): Promise<TaskRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, type, due_at, done_at, lead_id, deal_id, assignee_id')
    .eq('workspace_id', workspaceId)
    .gte('due_at', desde)
    .lte('due_at', ate)
    .order('due_at', { ascending: true })
    .limit(MAX_TAREFAS)

  if (error) {
    console.error('getTasksNoIntervalo falhou', error)
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
