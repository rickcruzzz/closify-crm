import 'server-only'

import type { Intencao, Objecao, Temperatura } from '@/lib/prospeccao/classificacao'
import { createAdminClient } from '@/lib/supabase/admin'

import { carregarPrateleira } from './prateleira-queries'
import { exigirAmbienteLocal } from './somente-local'
import type { InteracaoObservada, ProspectObservado } from './inteligencia'

/**
 * O acesso ao banco do painel de inteligência. A agregação mora em
 * `inteligencia.ts`, puro e testado.
 *
 * Mesmo desenho de `ativacao.ts` / `ativacao-queries.ts`. Aqui o I/O é
 * trivial e a decisão difícil — quando se recusar a mostrar uma taxa — está do
 * outro lado, onde o teste alcança.
 */

/** O mesmo teto do resto da Central: o PostgREST corta em 1.000 sem avisar. */
const TETO = 5000

export type LinhaDaFilaHumana = {
  dominio: string
  nome: string | null
  vertical: string | null
  telefone: string | null
  intencao: Intencao | null
  objecao: Objecao | null
  temperatura: Temperatura | null
  motivo: string | null
  respondidoEm: string | null
}

export type InteligenciaCarregada = {
  /** O universo inteiro — CSV mais banco, depois do opt-out. */
  descobertos: number
  prospects: ProspectObservado[]
  interacoes: InteracaoObservada[]
  /** Respostas gravadas que ainda ninguém classificou. */
  aClassificar: number
  /** Quem a IA se recusou a decidir. É a única fila acionável hoje. */
  filaHumana: LinhaDaFilaHumana[]
  lidoEm: string
}

export async function lerInteligencia(): Promise<InteligenciaCarregada> {
  await exigirAmbienteLocal()

  const supabase = createAdminClient()

  const [prateleira, prospectsCrus, interacoesCruas, recebidas, jaLidas] = await Promise.all([
    carregarPrateleira(),
    // String LITERAL, e ela é longa de propósito. Quebrar em `'a, b' + 'c, d'`
    // para caber na linha faz o tipo do retorno inteiro virar
    // `GenericStringError` — o supabase-js analisa esta string no NÍVEL DE
    // TIPO. Armadilha já registrada em `docs/estado-atual.md`, e paga de novo
    // aqui em 12/09.
    supabase
      .from('prospeccao_prospect')
      .select('dominio, nome, vertical, pontos, estagio, intencao, objecao, temperatura, enviado_em, respondido_em, mensagens_recebidas, precisa_humano, mensagem_enviada, telefone_ultimos8')
      .limit(TETO),
    supabase
      .from('prospeccao_interacao')
      .select('intencao, objecao, temperatura, confianca, precisa_humano, motivo_humano')
      .limit(TETO),
    // Quantas respostas existem no total, para a tela poder dizer quantas
    // faltam classificar. Sem esse número, "0 objeções" é ambíguo entre
    // "ninguém objetou" e "ninguém leu ainda" — e as duas pedem coisas opostas.
    supabase
      .from('mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('direcao', 'recebida'),
    supabase.from('prospeccao_interacao').select('id', { count: 'exact', head: true }),
  ])

  const prospects: ProspectObservado[] = (prospectsCrus.data ?? []).map((p) => ({
    dominio: p.dominio,
    vertical: p.vertical,
    pontos: p.pontos,
    estagio: p.estagio,
    intencao: (p.intencao as Intencao | null) ?? null,
    objecao: (p.objecao as Objecao | null) ?? null,
    temperatura: (p.temperatura as Temperatura | null) ?? null,
    enviadoEm: p.enviado_em,
    respondidoEm: p.respondido_em,
    mensagensRecebidas: p.mensagens_recebidas ?? 0,
    precisaHumano: p.precisa_humano ?? false,
    mensagemEnviada: p.mensagem_enviada,
  }))

  const interacoes: InteracaoObservada[] = (interacoesCruas.data ?? []).map((i) => ({
    intencao: i.intencao as Intencao,
    objecao: (i.objecao as Objecao | null) ?? null,
    temperatura: i.temperatura as Temperatura,
    confianca: i.confianca,
    precisaHumano: i.precisa_humano ?? false,
  }))

  const filaHumana: LinhaDaFilaHumana[] = (prospectsCrus.data ?? [])
    .filter((p) => p.precisa_humano)
    .map((p) => ({
      dominio: p.dominio,
      nome: p.nome,
      vertical: p.vertical,
      telefone: p.telefone_ultimos8,
      intencao: (p.intencao as Intencao | null) ?? null,
      objecao: (p.objecao as Objecao | null) ?? null,
      temperatura: (p.temperatura as Temperatura | null) ?? null,
      motivo: null,
      respondidoEm: p.respondido_em,
    }))
    .sort((a, b) => (b.respondidoEm ?? '').localeCompare(a.respondidoEm ?? ''))

  return {
    descobertos: prateleira.prospects.length,
    prospects,
    interacoes,
    aClassificar: Math.max(0, (recebidas.count ?? 0) - (jaLidas.count ?? 0)),
    filaHumana,
    lidoEm: new Date().toISOString(),
  }
}
