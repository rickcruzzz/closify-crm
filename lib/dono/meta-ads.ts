import 'server-only'

import { exigirAmbienteLocal } from './somente-local'
import type { Resultado, ResumoDoAnuncio } from './tipos'

/**
 * A conta de anúncio do Velo Funil.
 *
 * ## Por que ESTA conta, e não a que o histórico do projeto registrava
 *
 * Havia duas contas acessíveis, e `docs/estado-atual.md` apontava para a
 * errada (`27108979755418323`, "Orlando Henrique"). Verificado contra a API da
 * Meta em 20/08/2026:
 *
 * - O pixel que o site de fato alimenta é `1566349361566072` ("h-systens"), o
 *   mesmo valor de `NEXT_PUBLIC_META_PIXEL_ID`. Ele pertence ao business
 *   Rickdaskin e está atribuído a ESTA conta.
 * - A conta "Orlando Henrique" tem outro pixel (`987545847222328`), com 11
 *   PageViews no total e parado desde 13/08 — além de uma campanha de cliente
 *   de terceiro, o que reforça que não é a conta do produto.
 *
 * Campanha rodando na conta errada não enxerga as conversões do site: ela
 * otimizaria às cegas, gastando para aprender com um pixel vazio.
 */
export const CONTA_DE_ANUNCIO = {
  id: '1316925630418162',
  nome: 'Rickdaskin Ads',
} as const

/** O pixel que o site alimenta, o mesmo de `NEXT_PUBLIC_META_PIXEL_ID`. */
export const PIXEL_DO_SITE = '1566349361566072'

const VERSAO_DA_API = 'v21.0'

type Insight = {
  spend?: string
  reach?: string
  clicks?: string
  cpc?: string
}

type CampanhaDaApi = {
  id: string
  name: string
  status: string
  insights?: { data: Insight[] }
}

/**
 * Gasto e resultado do anúncio, quando existe um token que permita ler.
 *
 * ## Por que uma variável nova em vez do token que já existe
 *
 * `META_CONVERSIONS_API_TOKEN` serve para ENVIAR eventos de conversão, e a
 * permissão dele é só `read_ads_dataset_quality`. Testado contra a Graph API:
 * pedir insights com ele devolve `(#200) Ad account owner has NOT grant
 * ads_management or ads_read permission`. São capacidades diferentes, e
 * reaproveitar a variável faria a falha parecer bug em vez de permissão
 * faltando.
 *
 * Enquanto `META_ADS_TOKEN` não existir, esta função devolve um erro que a
 * tela mostra como instrução — não como bloco vazio nem, pior, como zero.
 * Gasto "R$ 0,00" por falta de token é indistinguível de gasto zero de verdade,
 * e a diferença entre as duas coisas é o que decide se há campanha rodando.
 */
export async function lerAnuncio(): Promise<Resultado<ResumoDoAnuncio>> {
  await exigirAmbienteLocal()

  const token = process.env.META_ADS_TOKEN
  if (!token) {
    return {
      ok: false,
      erro: 'Falta o META_ADS_TOKEN — um token da Meta com permissão ads_read. O que já existe no projeto (META_CONVERSIONS_API_TOKEN) só envia conversão, não lê gasto.',
    }
  }

  try {
    const parametros = new URLSearchParams({
      access_token: token,
      fields: 'id,name,status,insights.date_preset(last_30d){spend,reach,clicks,cpc}',
      limit: '50',
    })

    const resposta = await fetch(
      `https://graph.facebook.com/${VERSAO_DA_API}/act_${CONTA_DE_ANUNCIO.id}/campaigns?${parametros}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) },
    )

    const corpo = (await resposta.json()) as { data?: CampanhaDaApi[]; error?: { message: string } }

    if (corpo.error) {
      return { ok: false, erro: corpo.error.message }
    }

    const campanhas = corpo.data ?? []
    const numero = (valor: string | undefined) => Number(valor ?? 0) || 0

    // A Meta devolve os números como STRING. Somar sem converter concatena em
    // silêncio ("12" + "8" = "128") — o tipo de erro que passa por revisão e
    // vira decisão de orçamento errada.
    const somar = (extrair: (i: Insight) => string | undefined) =>
      campanhas.reduce((total, c) => total + numero(extrair(c.insights?.data[0] ?? {})), 0)

    const gasto = somar((i) => i.spend)
    const cliques = somar((i) => i.clicks)

    return {
      ok: true,
      dados: {
        contaId: CONTA_DE_ANUNCIO.id,
        contaNome: CONTA_DE_ANUNCIO.nome,
        gasto,
        alcance: somar((i) => i.reach),
        cliques,
        // Calculado do total, não pela média dos CPCs por campanha: média de
        // médias ignora o peso de cada campanha e dá um número que não bate
        // com gasto ÷ cliques, que é o que a pessoa confere na mão.
        custoPorClique: cliques > 0 ? gasto / cliques : 0,
        campanhas: campanhas.map((c) => ({
          id: c.id,
          nome: c.name,
          ativa: c.status === 'ACTIVE',
          gasto: numero(c.insights?.data[0]?.spend),
          cliques: numero(c.insights?.data[0]?.clicks),
        })),
      },
    }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui falar com a Meta.',
    }
  }
}
