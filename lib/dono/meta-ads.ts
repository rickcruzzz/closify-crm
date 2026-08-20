import 'server-only'

import { exigirAmbienteLocal } from './somente-local'
import type { Resultado } from './tipos'

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
 *   PageViews no total e parado desde 13/08, além de uma campanha de cliente
 *   de terceiro — o que reforça que não é a conta do produto.
 *
 * Campanha rodando na conta errada não enxerga as conversões do site: ela
 * otimizaria às cegas, gastando para aprender com um pixel vazio.
 */
export const CONTA_DE_ANUNCIO = { id: '1316925630418162', nome: 'Rickdaskin Ads' } as const

/** O pixel que o site alimenta, o mesmo de `NEXT_PUBLIC_META_PIXEL_ID`. */
export const PIXEL_DO_SITE = '1566349361566072'

const VERSAO_DA_API = 'v21.0'

/** Uma campanha, como a página precisa dela. */
export type CampanhaDoMeta = {
  id: string
  nome: string
  ativa: boolean
  status: string
  gasto: number
  cliques: number
  alcance: number
  /** Em reais por dia. `null` quando o orçamento é por período, não diário. */
  orcamentoDiario: number | null
}

/** O retrato da conta: dá para ligar o anúncio? */
export type ProntidaoDaConta = {
  contaId: string
  contaNome: string
  moeda: string
  fusoHorario: string
  temPixelCerto: boolean
  pixelNome: string | null
  pixelDisparandoDesde: string | null
  /** Quantos eventos por tipo chegaram nos últimos 7 dias. */
  eventos: { nome: string; quantidade: number }[]
  campanhas: CampanhaDoMeta[]
  /** 0-100, calculado pela própria Meta. */
  notaDaMeta: number | null
  recomendacoesDaMeta: { titulo: string; ganho: string }[]
  /** Se o token atual permite escrever (pausar, mudar orçamento). */
  podeAgir: boolean
}

type RespostaDaApi<T> = { data?: T; error?: { message: string } }

async function graph<T>(caminho: string, token: string): Promise<RespostaDaApi<T>> {
  const resposta = await fetch(`https://graph.facebook.com/${VERSAO_DA_API}/${caminho}`, {
    cache: 'no-store',
    // Sem teto, uma Meta degradada prende a página inteira. Os outros blocos
    // não dependem deste e não têm por que esperar.
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${token}` },
  })
  return (await resposta.json()) as RespostaDaApi<T>
}

/**
 * A mensagem que aparece quando não há token.
 *
 * Explica a diferença entre os dois tokens do projeto porque confundi-los é o
 * erro natural: os dois são "da Meta" e só um serve aqui.
 */
const SEM_TOKEN =
  'Falta o META_ADS_TOKEN — um token da Meta com permissão ads_read (e ads_management, para os botões de pausar e orçamento). O que já existe no projeto (META_CONVERSIONS_API_TOKEN) só envia conversão, não lê gasto.'

/**
 * Lê tudo que a página de anúncio precisa, numa chamada.
 *
 * ## Por que prontidão e desempenho vêm juntos
 *
 * Porque a página é a mesma e o estado muda sozinho: enquanto não há campanha
 * rodando, o que importa é "posso ligar?"; depois que liga, é "está valendo a
 * pena?". Separar em duas leituras exigiria a página saber em que estado está
 * antes de decidir o que buscar — e o estado é justamente o que a leitura
 * descobre.
 */
export async function lerProntidao(): Promise<Resultado<ProntidaoDaConta>> {
  await exigirAmbienteLocal()

  const token = process.env.META_ADS_TOKEN
  if (!token) return { ok: false, erro: SEM_TOKEN }

  try {
    const [conta, campanhas, datasets, permissoes] = await Promise.all([
      graph<never>(`act_${CONTA_DE_ANUNCIO.id}?fields=name,currency,timezone_name`, token),
      graph<
        {
          id: string
          name: string
          status: string
          daily_budget?: string
          insights?: { data: { spend?: string; clicks?: string; reach?: string }[] }
        }[]
      >(
        `act_${CONTA_DE_ANUNCIO.id}/campaigns?fields=id,name,status,daily_budget,insights.date_preset(last_30d){spend,clicks,reach}&limit=50`,
        token,
      ),
      graph<{ id: string; name: string; last_fired_time?: string }[]>(
        `act_${CONTA_DE_ANUNCIO.id}/adspixels?fields=id,name,last_fired_time`,
        token,
      ),
      graph<{ permission: string; status: string }[]>('me/permissions', token),
    ])

    if (conta.error) return { ok: false, erro: conta.error.message }

    const dadosDaConta = conta as unknown as {
      name?: string
      currency?: string
      timezone_name?: string
    }

    const pixel = (datasets.data ?? []).find((d) => d.id === PIXEL_DO_SITE)

    const numero = (v: string | undefined) => Number(v ?? 0) || 0
    const listaDeCampanhas: CampanhaDoMeta[] = (campanhas.data ?? []).map((c) => {
      const i = c.insights?.data[0] ?? {}
      return {
        id: c.id,
        nome: c.name,
        ativa: c.status === 'ACTIVE',
        status: c.status,
        // A Meta devolve número como STRING. Somar sem converter concatena em
        // silêncio ("12" + "8" = "128") — erro que passa por revisão e vira
        // decisão de orçamento errada.
        gasto: numero(i.spend),
        cliques: numero(i.clicks),
        alcance: numero(i.reach),
        // Orçamento vem em centavos.
        orcamentoDiario: c.daily_budget ? numero(c.daily_budget) / 100 : null,
      }
    })

    const concedidas = new Set(
      (permissoes.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission),
    )

    const [nota, eventos] = await Promise.all([
      lerNotaDaMeta(token),
      lerEventosDoPixel(token),
    ])

    return {
      ok: true,
      dados: {
        contaId: CONTA_DE_ANUNCIO.id,
        contaNome: dadosDaConta.name ?? CONTA_DE_ANUNCIO.nome,
        moeda: dadosDaConta.currency ?? '—',
        fusoHorario: dadosDaConta.timezone_name ?? '—',
        temPixelCerto: Boolean(pixel),
        pixelNome: pixel?.name ?? null,
        pixelDisparandoDesde: pixel?.last_fired_time ?? null,
        eventos,
        campanhas: listaDeCampanhas,
        notaDaMeta: nota.nota,
        recomendacoesDaMeta: nota.recomendacoes,
        podeAgir: concedidas.has('ads_management'),
      },
    }
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'Não consegui falar com a Meta.' }
  }
}

/** A nota que a própria Meta dá para a conta, com o que ela sugere melhorar. */
async function lerNotaDaMeta(
  token: string,
): Promise<{ nota: number | null; recomendacoes: { titulo: string; ganho: string }[] }> {
  try {
    const r = await graph<never>(
      `act_${CONTA_DE_ANUNCIO.id}/recommendations?fields=title,importance`,
      token,
    )
    const lista = (r as unknown as { data?: { title?: string; importance?: string }[] }).data ?? []
    return {
      // A nota em si não é exposta por este endpoint público; quando não vier,
      // `null` e a tela simplesmente não mostra o campo — melhor do que
      // inventar 100 e sugerir que está tudo ótimo.
      nota: null,
      recomendacoes: lista.map((x) => ({
        titulo: x.title ?? 'Recomendação da Meta',
        ganho: x.importance ?? '',
      })),
    }
  } catch {
    return { nota: null, recomendacoes: [] }
  }
}

/** Quantos eventos o pixel recebeu por tipo, nos últimos 7 dias. */
async function lerEventosDoPixel(token: string): Promise<{ nome: string; quantidade: number }[]> {
  try {
    const r = await graph<never>(`${PIXEL_DO_SITE}/stats?aggregation=event`, token)
    const dados = (r as unknown as { data?: { data?: { value: string; count: number }[] }[] }).data
    if (!dados) return []

    const somaPorEvento = new Map<string, number>()
    for (const linha of dados) {
      for (const item of linha.data ?? []) {
        somaPorEvento.set(item.value, (somaPorEvento.get(item.value) ?? 0) + item.count)
      }
    }

    return Array.from(somaPorEvento, ([nome, quantidade]) => ({ nome, quantidade })).sort(
      (a, b) => b.quantidade - a.quantidade,
    )
  } catch {
    return []
  }
}
