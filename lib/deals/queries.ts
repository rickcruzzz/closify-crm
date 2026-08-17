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
  /** Quando a etapa mudou pela última vez, base de "parado" (0033). */
  stage_changed_at: string
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
  const ownerNames = ownerIds.length > 0 ? await getMemberNames(workspaceId, ownerIds) : new Map()

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
    }
  })

  return { deals, totalPorEtapa }
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
    .select('id, name, email, company, phone')
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
