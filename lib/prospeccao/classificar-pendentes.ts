import 'server-only'

import { EMPRESAS_DE_PROSPECCAO } from '@/lib/prospeccao/empresas'
import { ultimos8 } from '@/lib/prospeccao/opt-out'
import { createAdminClient } from '@/lib/supabase/admin'

import { classificarResposta } from './classificar'
import { deveClassificar, proximoEstagio } from './classificacao'

/**
 * Percorre as respostas que ainda não foram lidas e classifica cada uma.
 *
 * Separado da rota de cron porque duas superfícies o chamam: o cron em
 * produção e o botão da Central, em `localhost`. Uma cópia em cada lugar
 * divergiria — e a forma de divergir seria a classificação feita à mão gravar
 * um estágio diferente da automática, com o painel somando os dois.
 */

export type ResultadoDaRodada = {
  pendentes: number
  classificadas: number
  falhas: number
  paraHumano: number
  /**
   * Mensagens que NAO foram ao modelo, por motivo.
   *
   * Contadas e devolvidas em vez de sumirem: fila que encolhe sem explicacao e
   * indistinguivel de fila que parou de ser lida, e este projeto ja pagou essa
   * confusao com o `purge_old_sinais_de_mercado` falhando quatro dias em
   * silencio.
   */
  ignoradas: { semTexto: number; foraDaFila: number }
  erros: string[]
}

type MensagemPendente = {
  id: string
  conversa_id: string
  texto: string
  tipo: string
  created_at: string
}

/** O que o classificador precisa saber do prospect, resolvido em lote. */
type ProspectDaFila = {
  id: string
  nome: string | null
  vertical: string | null
  mensagem_enviada: string | null
  estagio: string
  mensagens_recebidas: number | null
}

/**
 * A fila: mensagens RECEBIDAS, nas empresas de prospecção, sem interação.
 *
 * ## O `not.in` é sobre a tabela de interações, e o teto importa
 *
 * O PostgREST corta em 1.000 sem avisar — armadilha paga três vezes neste
 * projeto. Aqui o corte silencioso seria benigno (a rodada seguinte pega o
 * resto), mas o teto explícito deixa isso escrito em vez de dependente de
 * sorte.
 */
async function lerPendentes(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceIds: string[],
  teto: number,
): Promise<MensagemPendente[]> {
  const { data: jaLidas, error: erroDeLidas } = await supabase
    .from('prospeccao_interacao')
    .select('mensagem_id')
    .limit(5000)
  if (erroDeLidas) throw erroDeLidas

  const lidas = new Set((jaLidas ?? []).map((l) => l.mensagem_id))

  const { data, error } = await supabase
    .from('mensagens')
    .select('id, conversa_id, texto, tipo, created_at')
    .in('workspace_id', workspaceIds)
    .eq('direcao', 'recebida')
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) throw error

  // Filtrado em memória e não por `not.in` na query: a lista de ids já lidos
  // cresce sem teto, e mandá-la numa query string é o que devolve 414 — medido
  // em 11/08 com 2.000 valores.
  return (data ?? [])
    .filter((m) => !lidas.has(m.id) && m.texto.trim().length > 0)
    .slice(0, teto)
}

/**
 * Resolve o prospect de cada mensagem numa ida de rede por tabela, nao por
 * mensagem.
 *
 * O laco fazia tres consultas POR mensagem (conversa, lead, prospect). Com o
 * teto de 20 eram 60 viagens ate Sao Paulo antes de qualquer chamada ao
 * modelo, e a decisao de PULAR depende justamente da terceira: sem resolver em
 * lote, descobrir que 18 das 20 nao sao da fila custaria as 54 viagens
 * inteiras.
 */
async function resolverProspects(
  supabase: ReturnType<typeof createAdminClient>,
  mensagens: MensagemPendente[],
): Promise<Map<string, ProspectDaFila>> {
  const porMensagem = new Map<string, ProspectDaFila>()
  if (mensagens.length === 0) return porMensagem

  const conversaIds = Array.from(new Set(mensagens.map((m) => m.conversa_id)))
  const { data: conversas } = await supabase
    .from('conversas')
    .select('id, lead_id')
    .in('id', conversaIds)

  const leadPorConversa = new Map<string, string>()
  for (const c of conversas ?? []) if (c.lead_id) leadPorConversa.set(c.id, c.lead_id)

  const leadIds = Array.from(new Set(Array.from(leadPorConversa.values())))
  if (leadIds.length === 0) return porMensagem

  const { data: leads } = await supabase
    .from('leads')
    .select('id, phone')
    .in('id', leadIds)

  const oitoPorLead = new Map<string, string>()
  for (const l of leads ?? []) {
    const oito = ultimos8(l.phone)
    if (oito) oitoPorLead.set(l.id, oito)
  }

  const oitos = Array.from(new Set(Array.from(oitoPorLead.values())))
  if (oitos.length === 0) return porMensagem

  const { data: prospects } = await supabase
    .from('prospeccao_prospect')
    .select('id, nome, vertical, mensagem_enviada, estagio, mensagens_recebidas, telefone_ultimos8')
    .in('telefone_ultimos8', oitos)

  const porOito = new Map<string, ProspectDaFila>()
  for (const p of prospects ?? []) {
    // O primeiro vence. Dois prospects com os mesmos oito digitos finais e
    // possivel e raro, e escolher por ordem e melhor que escolher por acaso
    // de iteracao.
    if (p.telefone_ultimos8 && !porOito.has(p.telefone_ultimos8)) {
      porOito.set(p.telefone_ultimos8, p)
    }
  }

  for (const m of mensagens) {
    const leadId = leadPorConversa.get(m.conversa_id)
    const oito = leadId ? oitoPorLead.get(leadId) : undefined
    const prospect = oito ? porOito.get(oito) : undefined
    if (prospect) porMensagem.set(m.id, prospect)
  }

  return porMensagem
}

export async function classificarRespostasPendentes(opcoes: {
  teto?: number
}): Promise<ResultadoDaRodada> {
  const teto = opcoes.teto ?? 20
  const supabase = createAdminClient()
  const erros: string[] = []

  const { data: empresas, error: erroDeEmpresa } = await supabase
    .from('workspaces')
    .select('id')
    .in('name', EMPRESAS_DE_PROSPECCAO)
  if (erroDeEmpresa) throw erroDeEmpresa

  const ids = (empresas ?? []).map((e) => e.id)
  if (ids.length === 0) {
    return {
      pendentes: 0,
      classificadas: 0,
      falhas: 0,
      paraHumano: 0,
      ignoradas: { semTexto: 0, foraDaFila: 0 },
      erros: ['sem empresa de prospecção'],
    }
  }

  // A janela e maior que o teto de proposito: o teto conta quantas vao ao
  // MODELO, e a maioria dos candidatos agora e descartada antes disso. Ler so
  // 20 faria uma rodada inteira passar em branco sempre que 20 imagens
  // chegassem juntas, que e exatamente o que aconteceu em 17/09.
  const candidatos = await lerPendentes(supabase, ids, teto * 5)
  const ignoradas = { semTexto: 0, foraDaFila: 0 }

  // O tipo e conferido ANTES de resolver prospect: e um filtro de memoria, e
  // descartar dez imagens aqui evita as tres consultas que elas custariam.
  const comTexto: MensagemPendente[] = []
  for (const m of candidatos) {
    if (deveClassificar({ tipo: m.tipo, temProspect: true }).classificar) comTexto.push(m)
    else ignoradas.semTexto += 1
  }

  const prospectPorMensagem = await resolverProspects(supabase, comTexto)

  const pendentes: MensagemPendente[] = []
  for (const m of comTexto) {
    if (!deveClassificar({ tipo: m.tipo, temProspect: prospectPorMensagem.has(m.id) }).classificar) {
      ignoradas.foraDaFila += 1
      continue
    }
    if (pendentes.length < teto) pendentes.push(m)
  }

  let classificadas = 0
  let falhas = 0
  let paraHumano = 0

  for (const m of pendentes) {
    // O contexto: o que a empresa recebeu e o que já foi dito. Sem a abordagem
    // original o modelo lê a resposta no vácuo, "pode mandar" não quer dizer
    // nada sem saber o que foi oferecido. Por isso quem não tem prospect não
    // chega até aqui: o filtro acima é esse comentário virando código.
    const prospect = prospectPorMensagem.get(m.id)!

    const { data: anteriores } = await supabase
      .from('mensagens')
      .select('direcao, texto, created_at')
      .eq('conversa_id', m.conversa_id)
      .lt('created_at', m.created_at)
      .order('created_at', { ascending: true })
      .limit(10)

    const resultado = await classificarResposta({
      texto: m.texto,
      empresa: prospect.nome,
      vertical: prospect.vertical,
      abordagem: prospect.mensagem_enviada,
      historico: (anteriores ?? []).map((a) => ({
        de: a.direcao === 'recebida' ? ('cliente' as const) : ('nos' as const),
        texto: a.texto,
      })),
    })

    if ('erro' in resultado) {
      falhas += 1
      erros.push(`${m.id.slice(0, 8)}: ${resultado.erro}`)
      continue
    }

    const { error: erroDeGravacao } = await supabase.from('prospeccao_interacao').insert({
      prospect_id: prospect.id,
      conversa_id: m.conversa_id,
      mensagem_id: m.id,
      intencao: resultado.intencao,
      objecao: resultado.objecao,
      objecao_texto: resultado.objecaoTexto,
      temperatura: resultado.temperatura,
      estagio_antes: prospect.estagio,
      estagio_depois: resultado.estagio,
      confianca: resultado.confianca,
      precisa_humano: resultado.precisaHumano,
      motivo_humano: resultado.motivoHumano,
      resumo: resultado.resumo,
      modelo: resultado.modelo,
      versao_do_prompt: resultado.versaoDoPrompt,
    })

    // 23505 é o índice único em `mensagem_id`: outra execução classificou esta
    // mensagem enquanto esta rodava. É sucesso, não falha — e é a idempotência
    // funcionando, que é o que impede a mesma resposta de contar duas vezes na
    // estatística.
    if (erroDeGravacao && erroDeGravacao.code !== '23505') {
      falhas += 1
      erros.push(`${m.id.slice(0, 8)}: ${erroDeGravacao.message}`)
      continue
    }

    classificadas += 1
    if (resultado.precisaHumano) paraHumano += 1

    {
      // A regra mora em `classificacao.ts`, pura e com teste. Escrita aqui,
      // ela já deixou passar o defeito que a prova de 12/09 pegou: `indexOf`
      // devolvendo -1 para `OPTED_OUT` fazia qualquer mensagem seguinte
      // arrastar de volta quem tinha pedido para sair.
      const estagio = proximoEstagio(prospect.estagio, resultado.estagio)

      await supabase
        .from('prospeccao_prospect')
        .update({
          intencao: resultado.intencao,
          objecao: resultado.objecao,
          temperatura: resultado.temperatura,
          estagio,
          precisa_humano: resultado.precisaHumano,
          mensagens_recebidas: (prospect.mensagens_recebidas ?? 0) + 1,
          classificado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', prospect.id)
    }
  }

  return {
    pendentes: pendentes.length,
    classificadas,
    falhas,
    paraHumano,
    ignoradas,
    erros: erros.slice(0, 5),
  }
}
