import 'server-only'

import { exigirAmbienteLocal } from './somente-local'
import type { Resultado } from './tipos'
import {
  divisaoSegura,
  podeImportarConversao,
  reaisDeMicros,
  type AcaoDeConversao,
  type DesempenhoDoGoogle,
} from './google-ads'

/**
 * A leitura da conta do Google Ads.
 *
 * A decisão de por que este arquivo existe, por que o `login-customer-id` fica
 * de fora e por que a versão é a v22 está toda em `google-ads.ts`. Aqui mora só
 * o acesso à rede, para o núcleo continuar testável — mesmo desenho de
 * `trial.ts` (puro) e `trial-queries.ts` (I/O).
 */

/** v22 é a atual. De v16 a v21 respondem 404 — foram aposentadas. */
const VERSAO_DA_API = 'v22'

/**
 * A mensagem de credencial faltando diz O QUE falta.
 *
 * Mesma razão do `SEM_TOKEN` de `meta-ads.ts`: "erro ao ler o Google" manda a
 * pessoa investigar rede, e o problema é uma variável em branco. E são cinco
 * variáveis — dizer só "faltou credencial" obriga a caçar qual.
 */
const SEM_CREDENCIAL =
  'Faltam as credenciais do Google Ads no .env.local: GOOGLE_OAUTH_CLIENT_ID, ' +
  'GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, ' +
  'GOOGLE_ADS_DEVELOPER_TOKEN e GOOGLE_ADS_CUSTOMER_ID. As duas primeiras são ' +
  'as mesmas do "Entrar com Google" do produto; as três últimas são só desta leitura.'

type Credenciais = {
  clientId: string
  clientSecret: string
  refreshToken: string
  developerToken: string
  customerId: string
}

function lerCredenciais(): Credenciais | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  // Só dígitos: o Google aceita `784-188-3291` na tela e exige `7841883291` na
  // URL. Aceitar os dois formatos evita um 404 que parece falta de permissão.
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? '').replace(/\D/g, '')

  if (!clientId || !clientSecret || !refreshToken || !developerToken || !customerId) return null
  return { clientId, clientSecret, refreshToken, developerToken, customerId }
}

/** O access token dura uma hora; é pedido a cada leitura, sem cache. */
async function pegarAccessToken(c: Credenciais): Promise<string | null> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!r.ok) return null
  const j = (await r.json()) as { access_token?: string }
  return j.access_token ?? null
}

type LinhaDaBusca = Record<string, Record<string, unknown>>

async function buscar(
  c: Credenciais,
  accessToken: string,
  query: string,
): Promise<LinhaDaBusca[]> {
  const r = await fetch(
    `https://googleads.googleapis.com/${VERSAO_DA_API}/customers/${c.customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': c.developerToken,
        'Content-Type': 'application/json',
        // NÃO existe `login-customer-id` aqui. Ver o cabeçalho do arquivo.
      },
      body: JSON.stringify({ query }),
    },
  )
  if (!r.ok) throw new Error(`Google Ads respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = (await r.json()) as { results?: LinhaDaBusca[] }
  return j.results ?? []
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0
  return Number.isFinite(n) ? n : 0
}

/**
 * Tudo que a Central precisa do Google, numa passagem.
 *
 * As quatro consultas vão em `Promise.all` pela mesma razão que as leituras da
 * Central já vão: em série, cada uma paga a ida até os servidores do Google, e
 * a tela é `force-dynamic`.
 *
 * A janela é de 7 dias porque é o recorte em que a campanha ainda está em
 * aprendizado. Trinta dias diluiriam o que aconteceu ontem no que aconteceu
 * antes de a campanha existir.
 */
export async function lerDesempenhoDoGoogle(): Promise<Resultado<DesempenhoDoGoogle>> {
  await exigirAmbienteLocal()

  const cred = lerCredenciais()
  if (!cred) return { ok: false, erro: SEM_CREDENCIAL }

  try {
    const accessToken = await pegarAccessToken(cred)
    if (!accessToken) {
      return {
        ok: false,
        erro:
          'O refresh token do Google não foi aceito. Ele expira se ficar seis meses sem uso, ' +
          'ou se a senha da conta mudar, nos dois casos, é preciso refazer o consentimento.',
      }
    }

    const [contas, campanhas, palavras, acoes] = await Promise.all([
      buscar(
        cred,
        accessToken,
        'SELECT customer.id, customer.descriptive_name, customer.test_account, customer.currency_code FROM customer',
      ),
      buscar(
        cred,
        accessToken,
        'SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros, ' +
          'campaign.network_settings.target_google_search, ' +
          'campaign.network_settings.target_search_network, ' +
          'campaign.network_settings.target_content_network, ' +
          'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
          'FROM campaign WHERE segments.date DURING LAST_7_DAYS',
      ),
      buscar(
        cred,
        accessToken,
        'SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ' +
          'ad_group_criterion.status, metrics.impressions, metrics.clicks, metrics.cost_micros ' +
          'FROM keyword_view WHERE segments.date DURING LAST_7_DAYS',
      ),
      buscar(
        cred,
        accessToken,
        'SELECT conversion_action.name, conversion_action.status, conversion_action.type, ' +
          'conversion_action.category, conversion_action.counting_type, ' +
          'conversion_action.click_through_lookback_window_days FROM conversion_action',
      ),
    ])

    const c0 = contas[0]?.customer ?? {}
    const conversoes: AcaoDeConversao[] = acoes.map((l) => ({
      nome: String(l.conversionAction?.name ?? '-'),
      status: String(l.conversionAction?.status ?? '-'),
      tipo: String(l.conversionAction?.type ?? '-'),
      categoria: String(l.conversionAction?.category ?? '-'),
      contagem: String(l.conversionAction?.countingType ?? '-'),
      janelaDeCliqueEmDias: num(l.conversionAction?.clickThroughLookbackWindowDays),
    }))

    const redesDaPrimeira = campanhas[0]?.campaign?.networkSettings as
      | Record<string, boolean>
      | undefined

    return {
      ok: true,
      dados: {
        conta: {
          id: String(c0.id ?? cred.customerId),
          nome: String(c0.descriptiveName ?? '-'),
          // A flag que prova o nível do token: conta de teste é o que um
          // developer token não aprovado alcança.
          ehContaDeTeste: Boolean(c0.testAccount),
          moeda: String(c0.currencyCode ?? 'BRL'),
        },
        campanhas: campanhas.map((l) => {
          const cliques = num(l.metrics?.clicks)
          const impressoes = num(l.metrics?.impressions)
          const custo = reaisDeMicros(l.metrics?.cost_micros ?? l.metrics?.costMicros)
          return {
            id: String(l.campaign?.id ?? '-'),
            nome: String(l.campaign?.name ?? '-'),
            status: String(l.campaign?.status ?? '-'),
            orcamentoDiario: reaisDeMicros(
              l.campaignBudget?.amount_micros ?? l.campaignBudget?.amountMicros,
            ),
            impressoes,
            cliques,
            custo,
            conversoes: num(l.metrics?.conversions),
            cpcMedio: divisaoSegura(custo, cliques),
            ctr: divisaoSegura(cliques, impressoes),
          }
        }),
        palavras: palavras
          .map((l) => {
            const cliques = num(l.metrics?.clicks)
            const impressoes = num(l.metrics?.impressions)
            const k = l.adGroupCriterion?.keyword as Record<string, string> | undefined
            return {
              texto: String(k?.text ?? '-'),
              correspondencia: String(k?.matchType ?? '-'),
              status: String(l.adGroupCriterion?.status ?? '-'),
              impressoes,
              cliques,
              custo: reaisDeMicros(l.metrics?.cost_micros ?? l.metrics?.costMicros),
              ctr: divisaoSegura(cliques, impressoes),
            }
          })
          // Quem teve impressão primeiro: a lista existe para mostrar qual
          // termo está pagando por si, e sete zeros no topo escondem isso.
          .sort((a, b) => b.impressoes - a.impressoes || b.cliques - a.cliques),
        conversoes,
        redes: redesDaPrimeira
          ? {
              pesquisaDoGoogle: Boolean(redesDaPrimeira.targetGoogleSearch),
              parceirosDePesquisa: Boolean(redesDaPrimeira.targetSearchNetwork),
              display: Boolean(redesDaPrimeira.targetContentNetwork),
            }
          : null,
        podeImportarConversao: podeImportarConversao(conversoes),
      },
    }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui falar com o Google Ads.',
    }
  }
}
