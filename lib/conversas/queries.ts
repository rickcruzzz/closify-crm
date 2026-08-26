import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { ordenarPorEspera, type ConversaParaOrdenar } from '@/lib/conversas/ordenar'

/**
 * Leitura da tela de Conversas.
 *
 * A ordenação final acontece em `ordenarPorEspera`, não aqui, mesmo o banco já
 * devolvendo ordenado pelo índice `conversas_espera_idx`. Parece redundante e
 * não é: a regra de "quem está esperando" é de produto e precisa de teste, e
 * regra que só vive numa string SQL não tem nenhum.
 *
 * O `order by` continua na consulta porque é ele que faz o índice ser usado —
 * sem ele o Postgres varreria a tabela para depois o JavaScript ordenar.
 */

/** Quantas conversas a tela carrega de uma vez. */
const TETO_DE_CONVERSAS = 200

/** Quantas mensagens uma conversa aberta traz. */
const TETO_DE_MENSAGENS = 100

export type ConversaNaLista = ConversaParaOrdenar & {
  leadId: string
  nome: string
  telefone: string | null
  donoId: string | null
  assumidaEm: string | null
  /** Prévia da última mensagem, para a linha da lista. */
  previa: string
  /** Valor em aberto do negócio ligado a este contato, se houver. */
  valorDoNegocio: number | null
  etapaDoNegocio: string | null
}

export type MensagemNaTela = {
  id: string
  direcao: 'recebida' | 'enviada'
  tipo: string
  texto: string
  midiaChave: string | null
  midiaMime: string | null
  midiaSegundos: number | null
  status: string
  erro: string | null
  criadaEm: string
  enviadaPor: string | null
}

/**
 * As conversas da empresa, já na ordem que salva venda.
 *
 * Uma consulta com junção, não N+1: trazer o contato e o negócio de cada
 * conversa em ida separada seria uma ida por linha na tela mais aberta do
 * produto. Mesma classe do defeito que `getBoardDeals` já corrigiu.
 */
export async function getConversas(workspaceId: string): Promise<ConversaNaLista[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('conversas')
    .select(
      'id, lead_id, ultimo_recebido_em, ultimo_enviado_em, respondida_em, dono_id, assumida_em, leads!inner(name, phone)',
    )
    .eq('workspace_id', workspaceId)
    .is('arquivada_em', null)
    .order('respondida_em', { ascending: true, nullsFirst: true })
    .order('ultimo_recebido_em', { ascending: true })
    .limit(TETO_DE_CONVERSAS)

  // `error` checado: sem isto uma falha vira lista vazia e a tela diz "nenhuma
  // conversa" para quem tem cliente esperando. Classe 4 do diagnóstico.
  if (error) {
    console.error('getConversas: falha ao ler', error)
    return []
  }

  const linhas = data ?? []
  if (linhas.length === 0) return []

  // O negócio em aberto de cada contato, numa ida só. É a coluna da direita da
  // tela, e é o que nenhum chat sabe mostrar.
  //
  // Os nomes das etapas fechadas são `fechado_ganho` e `fechado_perdido`, e o
  // primeiro corte deste arquivo escreveu `ganho` e `perdido`. Valor fora do
  // enum não filtra errado: faz o PostgREST **recusar a consulta inteira**, e
  // como o `error` não era checado, `negocios` vinha indefinido e a coluna da
  // direita dizia "sem negócio em aberto" para todo mundo.
  //
  // Achado abrindo a tela com dado real: a empresa tinha 5 negócios no banco e
  // a tela mostrava zero. Classe 4 do diagnóstico de 25/08.
  const leadIds = linhas.map((l) => l.lead_id)
  const { data: negocios, error: erroNegocios } = await supabase
    .from('deals')
    .select('lead_id, value, stage')
    .eq('workspace_id', workspaceId)
    .in('lead_id', leadIds)
    .not('stage', 'in', '("fechado_ganho","fechado_perdido")')
    .limit(TETO_DE_CONVERSAS)

  if (erroNegocios) {
    // A lista ainda vale sem o valor do negócio — some a coluna da direita, não
    // a tela. Mas o erro precisa aparecer em algum lugar, senão a próxima falha
    // volta a virar "sem negócio" em silêncio, que foi exatamente o defeito.
    console.error('getConversas: falha ao ler os negócios em aberto', erroNegocios)
  }

  const porLead = new Map<string, { valor: number | null; etapa: string }>()
  for (const n of negocios ?? []) {
    if (n.lead_id && !porLead.has(n.lead_id)) {
      porLead.set(n.lead_id, { valor: n.value, etapa: n.stage })
    }
  }

  // A prévia vem da última mensagem de cada conversa. Uma ida para todas, com
  // `in`, e não uma por conversa.
  const previas = await ultimaMensagemDeCada(
    supabase,
    workspaceId,
    linhas.map((l) => l.id),
  )

  const conversas: ConversaNaLista[] = linhas.map((linha) => {
    // `leads!inner` devolve objeto; o supabase-js tipa como array em alguns
    // formatos de junção, então normalizamos os dois casos.
    const lead = Array.isArray(linha.leads) ? linha.leads[0] : linha.leads
    const negocio = porLead.get(linha.lead_id)

    return {
      id: linha.id,
      leadId: linha.lead_id,
      nome: lead?.name ?? 'Contato',
      telefone: lead?.phone ?? null,
      ultimoRecebidoEm: linha.ultimo_recebido_em,
      ultimoEnviadoEm: linha.ultimo_enviado_em,
      respondidaEm: linha.respondida_em,
      donoId: linha.dono_id,
      assumidaEm: linha.assumida_em,
      previa: previas.get(linha.id) ?? '',
      valorDoNegocio: negocio?.valor ?? null,
      etapaDoNegocio: negocio?.etapa ?? null,
    }
  })

  return ordenarPorEspera(conversas)
}

/**
 * A última mensagem de cada conversa, numa consulta só.
 *
 * Traz as mais recentes de todas as conversas juntas e fica com a primeira de
 * cada. O teto é o que impede isto de virar varredura: com 200 conversas na
 * tela, 200 mensagens bastam para preencher a prévia de todas no pior caso em
 * que cada uma tem exatamente uma.
 */
async function ultimaMensagemDeCada(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  conversaIds: string[],
): Promise<Map<string, string>> {
  const previa = new Map<string, string>()
  if (conversaIds.length === 0) return previa

  const { data, error } = await supabase
    .from('mensagens')
    .select('conversa_id, texto, direcao, created_at')
    .eq('workspace_id', workspaceId)
    .in('conversa_id', conversaIds)
    .order('created_at', { ascending: false })
    .limit(TETO_DE_CONVERSAS * 3)

  if (error) {
    console.error('ultimaMensagemDeCada: falha ao ler', error)
    return previa
  }

  for (const m of data ?? []) {
    if (previa.has(m.conversa_id)) continue
    previa.set(m.conversa_id, m.direcao === 'enviada' ? `Você: ${m.texto}` : m.texto)
  }

  return previa
}

/**
 * As mensagens de uma conversa, da mais antiga para a mais nova.
 *
 * Devolve `null` quando a conversa não é da empresa de quem pede. Não é só
 * cortesia: sem essa checagem, trocar o id na URL leria conversa alheia. A RLS
 * já barra no banco, e esta é a segunda camada — a que devolve uma tela
 * honesta em vez de uma lista vazia inexplicável.
 */
export async function getMensagensDaConversa(
  conversaId: string,
): Promise<{ mensagens: MensagemNaTela[]; leadId: string } | null> {
  const { workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data: conversa, error: erroConversa } = await supabase
    .from('conversas')
    .select('id, lead_id')
    .eq('id', conversaId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (erroConversa) {
    console.error('getMensagensDaConversa: falha ao ler a conversa', erroConversa)
    return null
  }
  if (!conversa) return null

  const { data, error } = await supabase
    .from('mensagens')
    .select(
      'id, direcao, tipo, texto, midia_chave, midia_mime, midia_segundos, status, erro, created_at, enviada_por',
    )
    .eq('conversa_id', conversaId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .limit(TETO_DE_MENSAGENS)

  if (error) {
    console.error('getMensagensDaConversa: falha ao ler mensagens', error)
    return null
  }

  return {
    leadId: conversa.lead_id,
    mensagens: (data ?? []).map((m) => ({
      id: m.id,
      direcao: m.direcao,
      tipo: m.tipo,
      texto: m.texto,
      midiaChave: m.midia_chave,
      midiaMime: m.midia_mime,
      midiaSegundos: m.midia_segundos,
      status: m.status,
      erro: m.erro,
      criadaEm: m.created_at,
      enviadaPor: m.enviada_por,
    })),
  }
}

/**
 * Quantas conversas estão esperando resposta, para o contador da barra lateral.
 *
 * `count: exact, head: true`: o banco devolve o NÚMERO, não as linhas. Roda no
 * layout, ou seja, em toda navegação do produto — trazer linha aqui seria pagar
 * rede para contar.
 */
export async function contarConversasEsperando(workspaceId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('conversas')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('respondida_em', null)
    .is('arquivada_em', null)
    .not('ultimo_recebido_em', 'is', null)

  if (error) {
    // Zero, e não erro: um contador que derruba a navegação inteira seria pior
    // que um contador ausente. Mesmo desenho de `contarTarefasDoDia`.
    console.error('contarConversasEsperando: falha ao contar', error)
    return 0
  }

  return count ?? 0
}

/**
 * O contador da barra lateral, resolvendo a sessão sozinho.
 *
 * Espelha `contarTarefasDoDiaDoUsuario`: existe para o layout poder chamá-la
 * dentro do `Promise.all` que já roda, sem precisar do `workspaceId` de fora.
 *
 * `getCurrentUserAndWorkspace` é `cache()`, então esta segunda chamada devolve
 * a promise da primeira — nenhuma ida de rede a mais por navegação. Encadear
 * em série custaria uma viagem em TODA navegação do produto, que é o defeito
 * já registrado em `docs/estado-atual.md`.
 */
export async function contarConversasEsperandoDoUsuario(): Promise<number> {
  const { workspaceId } = await getCurrentUserAndWorkspace()
  return contarConversasEsperando(workspaceId)
}
