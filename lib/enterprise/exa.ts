import 'server-only'

import { ESQUEMA_DO_EVENTO, PERGUNTA_DO_RESUMO } from '@/lib/enterprise/extracao'

/**
 * O único lugar do produto que fala com a Exa.
 *
 * ## A Exa VOLTOU ao produto em 22/10, e isso tem uma consequência legal
 *
 * A 0075 (08/09) tirou a pesquisa de mercado do lado do cliente porque ela
 * carregava a Exa como suboperador FORA DO BRASIL na Política de Privacidade,
 * por um caminho que ninguém usava. Este arquivo a traz de volta, a pedido do
 * dono, para o Radar Enterprise: a Exa lê páginas públicas que podem conter
 * nome, e-mail e telefone de organizadores. A Política precisa citá-la de novo
 * (`lib/legal.ts`) — decisão do dono, fora do escopo do código.
 *
 * ## Duas chamadas separadas, e é o teto da Netlify que decide
 *
 * A função da Netlify morre em ~10s. Medido em 22/10 contra a API real:
 *
 *     search                  ~1,9s   8 resultados
 *     contents + resumo       ~2,0s   UMA página
 *
 * Buscar e resumir oito páginas na mesma Action passaria de 15s, e a função
 * seria cortada no meio — exatamente o defeito do "Adotar instância" girando
 * para sempre. Então a busca devolve só os endereços, e cada página é
 * analisada numa Action própria, chamada pela tela uma a uma.
 *
 * Os tetos abaixo deixam ~3s para o Supabase dentro de cada Action.
 */

const BASE = 'https://api.exa.ai'
const TETO_DA_BUSCA_MS = 6_000
const TETO_DA_PAGINA_MS = 6_500

/**
 * Redes sociais e agregadores não são a página oficial de um evento: trazem
 * post, não data e organizador, e cada um custaria uma análise à toa.
 */
const DOMINIOS_EXCLUIDOS = [
  'instagram.com',
  'facebook.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'wikipedia.org',
]

export function exaConfigurada(): boolean {
  return Boolean(process.env.EXA_API_KEY)
}

async function chamar<T>(rota: string, corpo: unknown, tetoMs: number): Promise<T> {
  const chave = process.env.EXA_API_KEY
  if (!chave) throw new Error('EXA_API_KEY não configurada.')
  const resposta = await fetch(`${BASE}/${rota}`, {
    method: 'POST',
    headers: { 'x-api-key': chave, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(tetoMs),
    cache: 'no-store',
  })
  if (!resposta.ok) {
    throw new Error(`Exa ${rota} respondeu ${resposta.status}`)
  }
  return (await resposta.json()) as T
}

export type PaginaCandidata = { url: string; titulo: string | null }

/** Os endereços de páginas de eventos na cidade. Não lê nenhuma delas. */
export async function buscarPaginasDeEventos(cidade: string): Promise<PaginaCandidata[]> {
  const ano = new Date().getFullYear()
  const r = await chamar<{ results?: { url?: string; title?: string | null }[] }>(
    'search',
    {
      query: `congresso, feira, exposição ou evento corporativo em ${cidade} em ${ano} ou ${ano + 1}, página oficial do evento com data e organizador`,
      type: 'auto',
      numResults: 10,
      userLocation: 'BR',
      excludeDomains: DOMINIOS_EXCLUIDOS,
    },
    TETO_DA_BUSCA_MS,
  )
  return (r.results ?? [])
    .filter((p): p is { url: string; title?: string | null } => typeof p.url === 'string' && p.url.startsWith('https://'))
    .map((p) => ({ url: p.url, titulo: p.title?.trim() || null }))
}

export type PaginaLida = { resumo: unknown; texto: string | null; titulo: string | null }

/** Uma página: o resumo estruturado e o texto, para achar o contato escrito. */
export async function lerPaginaDeEvento(url: string): Promise<PaginaLida> {
  const r = await chamar<{
    results?: { summary?: unknown; text?: string | null; title?: string | null }[]
  }>(
    'contents',
    {
      urls: [url],
      // O texto vai junto para `primeiroEmail` e `primeiroTelefone`: o resumo
      // deixou o contato de fora na medição real, e ele estava no rodapé.
      text: { maxCharacters: 15_000 },
      summary: { query: PERGUNTA_DO_RESUMO, schema: ESQUEMA_DO_EVENTO },
      // `fallback` e não `always`: forçar leitura ao vivo de toda página
      // custaria segundos que a Netlify não tem.
      livecrawl: 'fallback',
    },
    TETO_DA_PAGINA_MS,
  )
  const pagina = r.results?.[0]
  return { resumo: pagina?.summary ?? null, texto: pagina?.text ?? null, titulo: pagina?.title ?? null }
}
