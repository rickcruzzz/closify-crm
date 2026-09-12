import 'server-only'

import { EMPRESAS_DE_PROSPECCAO } from '@/lib/prospeccao/empresas'
import { ultimos8 } from '@/lib/prospeccao/opt-out'
import { createAdminClient } from '@/lib/supabase/admin'

import { classificarResposta } from './classificar'
import { proximoEstagio } from './classificacao'

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
  erros: string[]
}

type MensagemPendente = {
  id: string
  conversa_id: string
  texto: string
  created_at: string
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
    .select('id, conversa_id, texto, created_at')
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
    return { pendentes: 0, classificadas: 0, falhas: 0, paraHumano: 0, erros: ['sem empresa de prospecção'] }
  }

  const pendentes = await lerPendentes(supabase, ids, teto)
  let classificadas = 0
  let falhas = 0
  let paraHumano = 0

  for (const m of pendentes) {
    // O contexto: de quem é a conversa, o que a empresa recebeu, e o que já
    // foi dito. Sem a abordagem original o modelo lê a resposta no vácuo —
    // "pode mandar" não quer dizer nada sem saber o que foi oferecido.
    const { data: conversa } = await supabase
      .from('conversas')
      .select('id, lead_id')
      .eq('id', m.conversa_id)
      .maybeSingle()

    const { data: lead } = conversa?.lead_id
      ? await supabase
          .from('leads')
          .select('name, phone, company')
          .eq('id', conversa.lead_id)
          .maybeSingle()
      : { data: null }

    const oito = ultimos8(lead?.phone)
    const { data: prospect } = oito
      ? await supabase
          .from('prospeccao_prospect')
          .select('id, nome, vertical, mensagem_enviada, estagio, mensagens_recebidas')
          .eq('telefone_ultimos8', oito)
          .limit(1)
          .maybeSingle()
      : { data: null }

    const { data: anteriores } = await supabase
      .from('mensagens')
      .select('direcao, texto, created_at')
      .eq('conversa_id', m.conversa_id)
      .lt('created_at', m.created_at)
      .order('created_at', { ascending: true })
      .limit(10)

    const resultado = await classificarResposta({
      texto: m.texto,
      empresa: prospect?.nome ?? lead?.company ?? lead?.name ?? null,
      vertical: prospect?.vertical ?? null,
      abordagem: prospect?.mensagem_enviada ?? null,
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
      prospect_id: prospect?.id ?? null,
      conversa_id: m.conversa_id,
      mensagem_id: m.id,
      intencao: resultado.intencao,
      objecao: resultado.objecao,
      objecao_texto: resultado.objecaoTexto,
      temperatura: resultado.temperatura,
      estagio_antes: prospect?.estagio ?? null,
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

    if (prospect) {
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

  return { pendentes: pendentes.length, classificadas, falhas, paraHumano, erros: erros.slice(0, 5) }
}
