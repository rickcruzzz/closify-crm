import 'server-only'

import { ESQUEMA_DO_EVENTO, PERGUNTA_DO_RESUMO, chaveDaPagina } from '@/lib/enterprise/extracao'

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
// Roda EM PARALELO com a releitura da página (`TETO_DA_PAGINA_MS`), então não
// soma: o teto da Action continua sendo o da página.
const TETO_DO_CONTATO_MS = 5_000

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

/**
 * Várias consultas, e não uma (25/10).
 *
 * Medido contra a API real: UMA consulta de 10 resultados trazia as mesmas 10
 * páginas a cada varredura, e a segunda varredura do dia achou 1 evento novo.
 * Sete consultas de 25, em paralelo, trouxeram 133 páginas únicas em 2,2s, e
 * cada consulta ainda acrescentou de 14 a 21 que as outras não tinham.
 *
 * Cada uma puxa um ângulo diferente do mesmo universo: o tipo de evento
 * (congresso, feira, simpósio), quem vende espaço nele (expositores,
 * patrocínio, estandes) e a agenda do lugar onde acontece.
 */
function consultasDoRadar(cidade: string, ano: number): string[] {
  const anos = `${ano} ou ${ano + 1}`
  return [
    `congresso, feira, exposição ou evento corporativo em ${cidade} em ${anos}, página oficial do evento com data e organizador`,
    `congresso nacional em ${cidade} Bahia ${ano} ${ano + 1} inscrições`,
    `feira de negócios ${cidade} Bahia ${ano} ${ano + 1} expositores`,
    `simpósio ou encontro profissional em ${cidade} ${ano} ${ano + 1}`,
    `Centro de Convenções ${cidade} agenda de eventos ${ano}`,
    `evento corporativo ${cidade} ${ano + 1} patrocínio e estandes`,
    `exposição setorial Bahia ${cidade} ${ano} ${ano + 1} organizadora`,
  ]
}

/** Quantas páginas uma varredura analisa, no máximo. Ver `buscarPaginasDeEventos`. */
export const PAGINAS_POR_VARREDURA = 60

/**
 * Os endereços de páginas de eventos na cidade. Não lê nenhuma delas.
 *
 * Os resultados das consultas são INTERCALADOS (o 1º de cada uma, depois o 2º
 * de cada uma…) antes do corte em `PAGINAS_POR_VARREDURA`: cortar na ordem de
 * chegada deixaria só as duas primeiras consultas, e a variedade é o motivo de
 * existirem sete. Uma consulta que falhar não derruba as outras.
 */
export async function buscarPaginasDeEventos(cidade: string): Promise<PaginaCandidata[]> {
  const ano = new Date().getFullYear()
  const respostas = await Promise.allSettled(
    consultasDoRadar(cidade, ano).map((query) =>
      chamar<{ results?: { url?: string; title?: string | null }[] }>(
        'search',
        { query, type: 'auto', numResults: 25, userLocation: 'BR', excludeDomains: DOMINIOS_EXCLUIDOS },
        TETO_DA_BUSCA_MS,
      ),
    ),
  )
  const listas = respostas.map((r) =>
    r.status === 'fulfilled'
      ? (r.value.results ?? [])
          .filter((p): p is { url: string; title?: string | null } => typeof p.url === 'string' && p.url.startsWith('https://'))
          .map((p) => ({ url: p.url, titulo: p.title?.trim() || null }))
      : [],
  )
  if (respostas.every((r) => r.status === 'rejected')) {
    throw new Error('Nenhuma consulta da Exa respondeu.')
  }

  const vistas = new Set<string>()
  const intercaladas: PaginaCandidata[] = []
  const maior = Math.max(...listas.map((l) => l.length))
  for (let i = 0; i < maior; i++) {
    for (const lista of listas) {
      const pagina = lista[i]
      if (!pagina) continue
      const chave = chaveDaPagina(pagina.url)
      if (vistas.has(chave)) continue
      vistas.add(chave)
      intercaladas.push(pagina)
    }
  }
  return intercaladas
}

/**
 * Páginas públicas onde o contato comercial do evento pode estar escrito.
 *
 * Medido em 22/10: para 5 eventos que chegaram sem contato, esta busca achou
 * e-mail E telefone em 4, em ~1,5s cada. Ler o próprio site ao vivo, com as
 * subpáginas, achou em 2 e levou até 11,5s, que a Netlify não tem.
 *
 * Só devolve o TEXTO das páginas. Quem decide se a página é do evento e se o
 * contato vale é `contatoEmOutraFonte`, que é pura e testada.
 */
export async function buscarPaginasDeContato(nome: string): Promise<{ url: string; texto: string | null }[]> {
  const r = await chamar<{ results?: { url?: string; text?: string | null }[] }>(
    'search',
    {
      query: `${nome} contato comercial expositores patrocínio e-mail telefone`,
      type: 'auto',
      numResults: 5,
      userLocation: 'BR',
      excludeDomains: DOMINIOS_EXCLUIDOS,
      contents: { text: { maxCharacters: 4_000 } },
    },
    TETO_DO_CONTATO_MS,
  )
  return (r.results ?? [])
    .filter((p): p is { url: string; text?: string | null } => typeof p.url === 'string')
    .map((p) => ({ url: p.url, texto: p.text ?? null }))
}

export type PaginaLida = { resumo: unknown; texto: string | null; titulo: string | null }

/** Imagens extraídas da própria fonte pública, sem inventar uma empresa pela busca. */
export async function imagensDaFonte(url: string): Promise<string[]> {
  const r = await chamar<{
    results?: { url?: string; image?: string; extras?: { imageLinks?: string[] } }[]
    statuses?: { status: string }[]
  }>('contents', { urls: [url], highlights: true, extras: { imageLinks: 5 } }, 4_000)
  if (r.statuses?.some((s) => s.status === 'error')) throw new Error('Exa não conseguiu ler a fonte da imagem.')
  const pagina = r.results?.[0]
  const candidatas = Array.from(new Set([pagina?.image, ...(pagina?.extras?.imageLinks ?? [])]))
    .filter((value): value is string => typeof value === 'string' && value.startsWith('https://'))
    .filter((value) => !/\.(svg|gif|avif|ico)(?:[?#]|$)/i.test(value))
  // imageLinks pode conter links HTML antes das imagens. Preserve a imagem
  // principal da fonte; sem ela, prefira um arquivo raster explícito.
  const imagem = (pagina?.image && candidatas.includes(pagina.image) ? pagina.image : null)
    ?? candidatas.find((value) => /\.(png|jpe?g|webp)(?:[?#]|$)/i.test(value))
    ?? candidatas[0]
  return imagem ? [imagem] : []
}

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
