import 'server-only'

import { exigirAmbienteLocal } from './somente-local'
import type { Resultado } from './tipos'

/**
 * A conta de anúncio do Velo Funil.
 *
 * ## A conta antiga saiu inteira em 09/09, e o motivo não era técnico
 *
 * Até aqui isto apontava para `1316925630418162` ("Rickdaskin Ads"), com o
 * pixel `1566349361566072` ("h-systens"). Essa conta **não podia veicular
 * anúncio nenhum**: o suporte da Meta confirmou uma restrição de Fraude e
 * Decepção no PERFIL PESSOAL, aplicada em 06/07/2026, que desativa o Meta Pay.
 * Sem Meta Pay, nenhum meio de pagamento funciona — nem cartão, nem Pix, nem
 * boleto, em conta nenhuma daquele usuário.
 *
 * O diagnóstico custou uma sessão inteira em 03/09 porque a API culpa
 * "pagamento" (`code 100`, `subcode 1815010`), o que manda mexer no cartão. As
 * hipóteses descartadas estão em `docs/campanha-meta.md`, para ninguém refazer
 * a ronda.
 *
 * A conta nova vem de outro perfil, sem restrição. **Nada do histórico
 * migra**: o pixel novo nasce zerado, e os ~21 `CompleteRegistration` e 6
 * `Purchase` do antigo ficam para trás. Não é perda relevante, porque aquele
 * pixel alimentava uma conta que nunca pôde gastar um real.
 *
 * ## O que continua valendo
 *
 * `PIXEL_DO_SITE` tem que ser o MESMO valor de `NEXT_PUBLIC_META_PIXEL_ID`, e
 * o token da Conversions API tem que ser gerado dentro DESTE dataset. Token de
 * um pixel com id de outro devolve **200 e não grava nada** — o pior tipo de
 * falha, porque parece sucesso.
 */
export const CONTA_DE_ANUNCIO = { id: '924551593583617', nome: 'Velo Funil' } as const

/** O pixel que o site alimenta, o mesmo de `NEXT_PUBLIC_META_PIXEL_ID`. */
export const PIXEL_DO_SITE = '947005175128975'

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

/**
 * Um conjunto de anúncio: onde moram o público e o objetivo de otimização.
 *
 * ## Por que isto precisa aparecer na tela
 *
 * A campanha diz quanto gastar; o CONJUNTO diz para quem e otimizando o quê.
 * Medido em 02/09 nesta conta: `optimization_goal: LINK_CLICKS`, que otimiza
 * por clique e **não usa o pixel para conversão**. Para aquisição de SaaS é a
 * configuração errada, e nada na tela anterior mostrava isso — ela parava na
 * campanha, onde esse campo não existe.
 */
export type ConjuntoDeAnuncio = {
  id: string
  nome: string
  status: string
  campanhaId: string
  /** `LINK_CLICKS`, `OFFSITE_CONVERSIONS`, `REACH`... */
  objetivo: string | null
  /** Em reais por dia. `null` quando o orçamento é da campanha. */
  orcamentoDiario: number | null
  /** Público, em texto legível: "Brasil · 18-65". */
  publico: string | null
  /** Quantos anúncios pendem deste conjunto. */
  totalDeAnuncios: number
}

/**
 * A campanha com a árvore embaixo dela.
 *
 * ## `totalDeAnuncios` está no tipo de propósito
 *
 * Medido em 02/09: esta conta tem campanha, conjunto e criativo, e **zero
 * anúncios**. Uma campanha assim não veicula nada, mesmo `ACTIVE` — e a tela
 * anterior mostrava "Pausada" com um botão Ligar que não faria efeito nenhum.
 *
 * Carregar o número no tipo é o que força a tela a tratar o caso, em vez de
 * documentá-lo. É a mesma escolha de `EmpresaComEstado` em 30/08, quando o
 * tipo passou a impedir que uma função que só leu o banco afirmasse quem paga.
 */
export type CampanhaCompleta = CampanhaDoMeta & {
  objetivo: string | null
  conjuntos: ConjuntoDeAnuncio[]
  totalDeAnuncios: number
}

/** O dinheiro da conta, que decide se a campanha chega a rodar. */
export type SaudeDaConta = {
  /** Já gasto na vida da conta, em reais. */
  gastoTotal: number
  /** Saldo pré-pago. `0` numa conta de pós-pago é normal, não é problema. */
  saldo: number
  /** Teto de gasto configurado. `0` significa sem teto. */
  tetoDeGasto: number
  /** 1 = ativa. Qualquer outro valor impede veiculação. */
  status: number
  /** Motivo da desativação, quando `status` não é 1. */
  motivoDaDesativacao: number
}

/** Um dia da série de gasto. */
export type DiaDeGasto = {
  dia: string
  gasto: number
  cliques: number
  impressoes: number
}

/**
 * O que uma leitura devolve quando pode falhar sozinha.
 *
 * ## Por que cada bloco falha por conta própria
 *
 * A versão anterior devolvia `ok: false` no primeiro erro, e a página trocava
 * a tela inteira por um card com a mensagem crua da Meta. Um endpoint fora do
 * ar apagava saldo, campanhas, pixel e permissões junto.
 *
 * É a mesma regra do vigia: `null` significa **não sei**, nunca "está
 * zerado", e um bloco que não pôde ser lido diz isso no lugar dele enquanto o
 * resto da tela continua de pé.
 */
export type Parcial<T> = { dados: T; erro: null } | { dados: null; erro: string }

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
  campanhas: CampanhaCompleta[]
  /** O dinheiro. `erro` quando a leitura falhou — não zero. */
  saude: Parcial<SaudeDaConta>
  /** Gasto dia a dia nos últimos 30. Vazio numa conta que nunca gastou. */
  serie: Parcial<DiaDeGasto[]>
  /** Públicos salvos na conta. */
  publicos: Parcial<{ id: string; nome: string; tamanho: number | null }[]>
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
  'Falta o META_ADS_TOKEN, um token da Meta com permissão ads_read (e ads_management, para os botões de pausar e orçamento). O que já existe no projeto (META_CONVERSIONS_API_TOKEN) só envia conversão, não lê gasto.'

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
    const [conta, campanhas, conjuntos, anuncios, datasets, permissoes, saude, serie, publicos] =
      await Promise.all([
        graph<never>(`act_${CONTA_DE_ANUNCIO.id}?fields=name,currency,timezone_name`, token),
        graph<
          {
            id: string
            name: string
            status: string
            objective?: string
            daily_budget?: string
            insights?: { data: { spend?: string; clicks?: string; reach?: string }[] }
          }[]
        >(
          `act_${CONTA_DE_ANUNCIO.id}/campaigns?fields=id,name,status,objective,daily_budget,insights.date_preset(last_30d){spend,clicks,reach}&limit=50`,
          token,
        ),
        graph<CruDoConjunto[]>(
          `act_${CONTA_DE_ANUNCIO.id}/adsets?fields=id,name,status,campaign_id,optimization_goal,daily_budget,targeting{geo_locations,age_min,age_max}&limit=50`,
          token,
        ),
        graph<{ id: string; adset_id: string; campaign_id: string }[]>(
          `act_${CONTA_DE_ANUNCIO.id}/ads?fields=id,adset_id,campaign_id&limit=200`,
          token,
        ),
        graph<{ id: string; name: string; last_fired_time?: string }[]>(
          `act_${CONTA_DE_ANUNCIO.id}/adspixels?fields=id,name,last_fired_time`,
          token,
        ),
        graph<{ permission: string; status: string }[]>('me/permissions', token),
        lerSaude(token),
        lerSerie(token),
        lerPublicos(token),
      ])

    if (conta.error) return { ok: false, erro: conta.error.message }

    const dadosDaConta = conta as unknown as {
      name?: string
      currency?: string
      timezone_name?: string
    }

    const pixel = (datasets.data ?? []).find((d) => d.id === PIXEL_DO_SITE)

    // Anúncios contados por conjunto E por campanha. A Meta devolve os dois
    // vínculos em cada `ad`, e ter os dois evita reconstruir a árvore de
    // baixo para cima — que erraria em campanha sem conjunto nenhum.
    const anunciosPorConjunto = new Map<string, number>()
    const anunciosPorCampanha = new Map<string, number>()
    for (const a of anuncios.data ?? []) {
      anunciosPorConjunto.set(a.adset_id, (anunciosPorConjunto.get(a.adset_id) ?? 0) + 1)
      anunciosPorCampanha.set(a.campaign_id, (anunciosPorCampanha.get(a.campaign_id) ?? 0) + 1)
    }

    const conjuntosPorCampanha = new Map<string, ConjuntoDeAnuncio[]>()
    for (const s of conjuntos.data ?? []) {
      const lista = conjuntosPorCampanha.get(s.campaign_id) ?? []
      lista.push({
        id: s.id,
        nome: s.name,
        status: s.status,
        campanhaId: s.campaign_id,
        objetivo: s.optimization_goal ?? null,
        orcamentoDiario: s.daily_budget ? numero(s.daily_budget) / 100 : null,
        publico: descreverPublico(s.targeting),
        totalDeAnuncios: anunciosPorConjunto.get(s.id) ?? 0,
      })
      conjuntosPorCampanha.set(s.campaign_id, lista)
    }

    const listaDeCampanhas: CampanhaCompleta[] = (campanhas.data ?? []).map((c) => {
      const i = c.insights?.data[0] ?? {}
      return {
        id: c.id,
        nome: c.name,
        ativa: c.status === 'ACTIVE',
        status: c.status,
        objetivo: c.objective ?? null,
        // A Meta devolve número como STRING. Somar sem converter concatena em
        // silêncio ("12" + "8" = "128") — erro que passa por revisão e vira
        // decisão de orçamento errada.
        gasto: numero(i.spend),
        cliques: numero(i.clicks),
        alcance: numero(i.reach),
        // Orçamento vem em centavos.
        orcamentoDiario: c.daily_budget ? numero(c.daily_budget) / 100 : null,
        conjuntos: conjuntosPorCampanha.get(c.id) ?? [],
        totalDeAnuncios: anunciosPorCampanha.get(c.id) ?? 0,
      }
    })

    const concedidas = new Set(
      (permissoes.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission),
    )

    const [nota, eventos] = await Promise.all([lerNotaDaMeta(token), lerEventosDoPixel(token)])

    return {
      ok: true,
      dados: {
        contaId: CONTA_DE_ANUNCIO.id,
        contaNome: dadosDaConta.name ?? CONTA_DE_ANUNCIO.nome,
        moeda: dadosDaConta.currency ?? '-',
        fusoHorario: dadosDaConta.timezone_name ?? '-',
        temPixelCerto: Boolean(pixel),
        pixelNome: pixel?.name ?? null,
        pixelDisparandoDesde: pixel?.last_fired_time ?? null,
        eventos,
        campanhas: listaDeCampanhas,
        saude,
        serie,
        publicos,
        notaDaMeta: nota.nota,
        recomendacoesDaMeta: nota.recomendacoes,
        podeAgir: concedidas.has('ads_management'),
      },
    }
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'Não consegui falar com a Meta.' }
  }
}

type CruDoConjunto = {
  id: string
  name: string
  status: string
  campaign_id: string
  optimization_goal?: string
  daily_budget?: string
  targeting?: {
    geo_locations?: { countries?: string[]; cities?: { name?: string }[] }
    age_min?: number
    age_max?: number
  }
}

const numero = (v: string | undefined) => Number(v ?? 0) || 0

/**
 * O público em uma linha legível: "Brasil · 18-65".
 *
 * O `targeting` cru da Meta é um objeto aninhado com dezenas de campos, e
 * despejá-lo na tela seria mostrar JSON para quem quer saber para quem o
 * anúncio aparece. Só o que decide isso entra: país (ou cidade) e faixa
 * etária.
 */
function descreverPublico(t: CruDoConjunto['targeting']): string | null {
  if (!t) return null
  const partes: string[] = []

  const cidades = (t.geo_locations?.cities ?? []).map((c) => c.name).filter(Boolean)
  const paises = t.geo_locations?.countries ?? []
  if (cidades.length > 0) partes.push(cidades.slice(0, 3).join(', '))
  else if (paises.length > 0) partes.push(paises.includes('BR') ? 'Brasil' : paises.join(', '))

  if (t.age_min || t.age_max) partes.push(`${t.age_min ?? 13}-${t.age_max ?? 65} anos`)

  return partes.length > 0 ? partes.join(' · ') : null
}

/** Saldo, gasto e teto — o que decide se a campanha chega a rodar. */
async function lerSaude(token: string): Promise<Parcial<SaudeDaConta>> {
  try {
    const r = (await graph<never>(
      `act_${CONTA_DE_ANUNCIO.id}?fields=amount_spent,balance,spend_cap,account_status,disable_reason`,
      token,
    )) as unknown as {
      error?: { message: string }
      amount_spent?: string
      balance?: string
      spend_cap?: string
      account_status?: number
      disable_reason?: number
    }
    if (r.error) return { dados: null, erro: r.error.message }
    return {
      // Os três vêm em centavos, como o orçamento.
      dados: {
        gastoTotal: numero(r.amount_spent) / 100,
        saldo: numero(r.balance) / 100,
        tetoDeGasto: numero(r.spend_cap) / 100,
        status: r.account_status ?? 0,
        motivoDaDesativacao: r.disable_reason ?? 0,
      },
      erro: null,
    }
  } catch (err) {
    return { dados: null, erro: err instanceof Error ? err.message : 'falhou' }
  }
}

/** Gasto dia a dia nos últimos 30, para a série da tela. */
async function lerSerie(token: string): Promise<Parcial<DiaDeGasto[]>> {
  try {
    const r = await graph<
      { date_start: string; spend?: string; clicks?: string; impressions?: string }[]
    >(
      `act_${CONTA_DE_ANUNCIO.id}/insights?fields=spend,clicks,impressions&date_preset=last_30d&time_increment=1`,
      token,
    )
    if (r.error) return { dados: null, erro: r.error.message }
    return {
      dados: (r.data ?? []).map((d) => ({
        dia: d.date_start,
        gasto: numero(d.spend),
        cliques: numero(d.clicks),
        impressoes: numero(d.impressions),
      })),
      erro: null,
    }
  } catch (err) {
    return { dados: null, erro: err instanceof Error ? err.message : 'falhou' }
  }
}

/** Públicos salvos, para saber o que já existe antes de criar outro. */
async function lerPublicos(
  token: string,
): Promise<Parcial<{ id: string; nome: string; tamanho: number | null }[]>> {
  try {
    const r = await graph<{ id: string; name: string; approximate_count_lower_bound?: number }[]>(
      `act_${CONTA_DE_ANUNCIO.id}/customaudiences?fields=id,name,approximate_count_lower_bound&limit=25`,
      token,
    )
    if (r.error) return { dados: null, erro: r.error.message }
    return {
      dados: (r.data ?? []).map((p) => ({
        id: p.id,
        nome: p.name,
        tamanho: p.approximate_count_lower_bound ?? null,
      })),
      erro: null,
    }
  } catch (err) {
    return { dados: null, erro: err instanceof Error ? err.message : 'falhou' }
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
