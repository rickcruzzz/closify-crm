import { createClient } from '@/lib/supabase/server'
import type { DealStage } from '@/lib/deals/types'
import { eventoQueRepresenta, potencialNoCard, type PotencialNoCard } from '@/lib/enterprise/potencial'
import { diaEmSaoPaulo } from '@/lib/tasks/buckets'

export type DealRow = {
  id: string
  title: string
  lead_id: string | null
  value: number
  stage: DealStage
  due_date: string | null
  created_at: string
  /** Quando a etapa mudou pela última vez, base de "parado" (0033). */
  stage_changed_at: string
  owner_id: string | null
  owner_name: string | null
  /**
   * O potencial do Radar Enterprise, quando o contato do negócio veio de um
   * evento (22/10). Ausente em todo o resto — inclusive em toda empresa que
   * não é Enterprise, onde a RLS de `enterprise_eventos` não devolve nada.
   */
  radar?: PotencialNoCard | null
}

export type DealLeadRow = {
  id: string
  name: string
  /** Nulo quando o lead veio de planilha sem coluna de e-mail. */
  email: string | null
  company: string | null
  phone: string | null
  /**
   * O valor estimado guardado no contato, usado para pré-preencher o
   * formulário de negócio.
   *
   * A importação de planilha já fazia isso (`lib/leads/actions.ts`: o negócio
   * nasce com `value: origem?.value`), mas a criação manual não — quem
   * cadastrava um contato com valor e depois abria "Novo negócio" digitava o
   * mesmo número de novo. Dois caminhos para o mesmo dado discordando entre
   * si.
   */
  value: number
}

/**
 * O board com o que foi cortado, explicitamente.
 *
 * Quantos negócios cada etapa TEM, ao lado de quantos vieram. A tela usa a
 * diferença para avisar, sem isso o corte seria tão silencioso quanto o teto
 * do PostgREST que ele veio substituir, só que decidido por nós.
 */
export type BoardDoKanban = {
  deals: DealRow[]
  totalPorEtapa: Record<DealStage, number>
}

/**
 * Quantos cards cada coluna carrega.
 *
 * Teto POR ETAPA e não global: as etapas fechadas acumulam para sempre, e um
 * limite único deixaria "Fechado ganho" comendo a cota das colunas onde o
 * trabalho acontece. Duzentos é bem mais do que cabe numa tela e bem menos do
 * que o teto de 1.000 do PostgREST.
 */
const CARDS_POR_ETAPA = 200

/**
 * O board do Kanban, com teto por etapa.
 *
 * A versão anterior lia a tabela inteira sem limite. O PostgREST corta em
 * 1.000 linhas e NÃO devolve erro, como a ordem era por data decrescente, os
 * negócios mais antigos simplesmente sumiam do quadro. Card desaparecendo sem
 * aviso é a pior forma de falhar: parece dado perdido.
 *
 * A RPC devolve `total_na_etapa` junto para a tela poder dizer quantos ficaram
 * de fora em vez de fingir que aqueles são todos.
 */
export async function getBoardDeals(workspaceId: string): Promise<BoardDoKanban> {
  const supabase = await createClient()

  const vazio: BoardDoKanban = { deals: [], totalPorEtapa: {} as Record<DealStage, number> }

  const { data, error } = await supabase.rpc('get_board_deals', {
    target_workspace_id: workspaceId,
    por_etapa: CARDS_POR_ETAPA,
  })

  if (error || !data) {
    if (error) console.error('getBoardDeals falhou', error)
    return vazio
  }

  const ownerIds = Array.from(new Set(data.map((d) => d.owner_id).filter((id): id is string => !!id)))
  const leadIds = Array.from(new Set(data.map((d) => d.lead_id).filter((id): id is string => !!id)))
  // As duas na mesma onda: nenhuma depende da outra, e o board é a tela que a
  // pessoa abre de manhã.
  const [ownerNames, radarPorLead] = await Promise.all([
    ownerIds.length > 0 ? getMemberNames(workspaceId, ownerIds) : Promise.resolve(new Map<string, string>()),
    getPotencialDoRadar(workspaceId, leadIds),
  ])

  const totalPorEtapa = {} as Record<DealStage, number>

  const deals: DealRow[] = data.map((linha) => {
    // `total_na_etapa` vem repetido em toda linha da mesma etapa, é uma
    // janela, não uma agregação separada. Sai do card e vai para o cabeçalho
    // da coluna, então é lido aqui e não segue adiante.
    totalPorEtapa[linha.stage] = Number(linha.total_na_etapa)

    return {
      id: linha.id,
      title: linha.title,
      lead_id: linha.lead_id,
      value: linha.value,
      stage: linha.stage,
      due_date: linha.due_date,
      created_at: linha.created_at,
      stage_changed_at: linha.stage_changed_at,
      owner_id: linha.owner_id,
      owner_name: linha.owner_id ? ownerNames.get(linha.owner_id) ?? null : null,
      radar: linha.lead_id ? radarPorLead.get(linha.lead_id) ?? null : null,
    }
  })

  return { deals, totalPorEtapa }
}

/**
 * O potencial do Radar de cada contato, numa ida só.
 *
 * O dado já está gravado no evento (`prioridade`, e os campos de onde sai o
 * resumo) desde que o contato nasceu dele. Copiá-lo para `leads` criaria uma
 * segunda verdade que envelheceria sozinha quando o evento fosse reavaliado.
 *
 * Falhar aqui NÃO derruba o board: o potencial é um enfeite útil, e o board
 * sem ele continua sendo o board. Empresa sem Enterprise recebe zero linhas
 * pela RLS, sem erro.
 */
async function getPotencialDoRadar(
  workspaceId: string,
  leadIds: string[],
): Promise<Map<string, PotencialNoCard>> {
  const porLead = new Map<string, PotencialNoCard>()
  if (leadIds.length === 0) return porLead

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('enterprise_eventos')
    .select('lead_id, prioridade, data_inicio, organizador, contato_email, contato_telefone, publico_estimado')
    .eq('workspace_id', workspaceId)
    .in('lead_id', leadIds)
    .neq('status', 'descartado')

  if (error) {
    console.error('getPotencialDoRadar falhou', error)
    return porLead
  }

  const hoje = diaEmSaoPaulo(new Date())
  const agrupados = new Map<string, NonNullable<typeof data>>()
  for (const evento of data ?? []) {
    if (!evento.lead_id) continue
    agrupados.set(evento.lead_id, [...(agrupados.get(evento.lead_id) ?? []), evento])
  }
  agrupados.forEach((eventos, leadId) => {
    const escolhido = eventoQueRepresenta(eventos, hoje)
    if (escolhido) porLead.set(leadId, potencialNoCard(escolhido, hoje))
  })
  return porLead
}

/**
 * Um negócio só, pelo id, para quando o link aponta para fora do board.
 *
 * `getBoardDeals` traz no máximo `CARDS_POR_ETAPA` por coluna. Um link como
 * `/kanban?negocio=<id>` que aponte para um negócio fora desse corte abriria
 * um painel vazio — exatamente o beco sem saída que os links do dashboard
 * existem para fechar.
 *
 * Só é chamada quando o parâmetro está presente E o id não veio no board, ou
 * seja: nunca no caminho normal de abrir o funil.
 */
export async function getDealAvulso(
  workspaceId: string,
  dealId: string,
): Promise<DealRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deals')
    .select(
      'id, title, lead_id, value, stage, due_date, created_at, stage_changed_at, owner_id',
    )
    .eq('workspace_id', workspaceId)
    .eq('id', dealId)
    .maybeSingle()

  // Id inexistente, de outra empresa (a RLS recusa) ou erro de leitura: nos
  // três casos não há negócio para abrir, e o board renderiza normalmente.
  if (error) {
    console.error('getDealAvulso falhou', error)
    return null
  }
  if (!data) return null

  const ownerNames = data.owner_id
    ? await getMemberNames(workspaceId, [data.owner_id])
    : new Map<string, string>()

  return {
    id: data.id,
    title: data.title,
    lead_id: data.lead_id,
    value: data.value,
    stage: data.stage,
    due_date: data.due_date,
    created_at: data.created_at,
    stage_changed_at: data.stage_changed_at,
    owner_id: data.owner_id,
    owner_name: data.owner_id ? ownerNames.get(data.owner_id) ?? null : null,
  }
}

/**
 * Teto do seletor de leads do formulário de negócio.
 *
 * Não é paginação: um `<select>` com mais de algumas centenas de itens já é
 * inútil para escolher, muito antes de ser pesado. O limite é explícito para
 * que o corte seja uma decisão nossa, e não o teto silencioso do PostgREST.
 */
const LEADS_NO_SELETOR = 500

/**
 * Os leads que o formulário de negócio oferece.
 *
 * Ordenava por NOME e sem limite. Passando de 1.000 leads o PostgREST cortava
 * calado, e sumia justamente quem vinha depois no alfabeto, a pessoa não
 * conseguia criar negócio para um cliente que existia e aparecia na lista de
 * Leads.
 *
 * Agora vem por data decrescente: lead recém-cadastrado é o que mais entra em
 * negócio novo, e é o que a pessoa acabou de digitar. Ordem alfabética punia
 * exatamente esse caso.
 */
export async function getWorkspaceLeadsForSelect(workspaceId: string): Promise<DealLeadRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('leads')
    .select('id, name, email, company, phone, value')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(LEADS_NO_SELETOR)

  if (error) {
    console.error('getWorkspaceLeadsForSelect falhou', error)
    return []
  }

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

/**
 * Os negócios em andamento de um contato, para a tarefa poder nascer ligada.
 *
 * Existe porque a página do Contato criava tarefa passando só `leadId`: a
 * tarefa nascia invisível para o painel do negócio, que só enxerga `deal_id`
 * (`getProximaAcaoPorNegocio`). O resultado era o painel dizer "Nenhuma
 * agendada" e oferecer criar outra — duas tarefas para o mesmo compromisso.
 *
 * **Só etapa aberta.** Ligar tarefa a negócio já ganho ou perdido agenda
 * trabalho para algo que terminou; a próxima ação dele não é lida por
 * ninguém, e o compromisso sumiria da vista.
 *
 * O `.limit()` é explícito porque o PostgREST corta em 1.000 linhas **sem
 * avisar** — armadilha que este projeto já pagou três vezes. Aqui o teto é bem
 * menor: é lista para escolher com o olho, num seletor.
 */
export async function getNegociosAbertosDoLead(
  workspaceId: string,
  leadId: string,
): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deals')
    .select('id, title')
    .eq('workspace_id', workspaceId)
    .eq('lead_id', leadId)
    .not('stage', 'in', '(fechado_ganho,fechado_perdido)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    // Consulta acessória: sem ela o formulário perde o campo "Negócio" e
    // continua criando a tarefa do contato, que é o comportamento antigo.
    // Derrubar a página do contato por causa disso seria pior.
    console.error('getNegociosAbertosDoLead falhou', error)
    return []
  }

  return data ?? []
}
