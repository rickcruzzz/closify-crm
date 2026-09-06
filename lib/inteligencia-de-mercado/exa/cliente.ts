import 'server-only'

import { ExaIndisponivel, ExaRecusou, ExaSemCredito } from './erros'
import type { RespostaBruta, ResultadoBruto } from './tipos'

/**
 * O ÚNICO ponto do projeto que fala HTTP com o Exa.
 *
 * `import 'server-only'` porque a chave não pode atravessar para o navegador —
 * mesmo cuidado de `lib/dono/queries.ts`. Se alguém importar isto de um
 * componente de cliente, o build quebra, que é exatamente o que se quer.
 */

const ENDERECO = 'https://api.exa.ai/search'

/** Doze segundos. Passou disso, a fila desiste e tenta na passagem seguinte. */
const TIMEOUT_MS = 12_000

export type ConsultaAoExa = {
  texto: string
  dominios: string[]
  publicadoDepoisDe: string
  numeroDeResultados?: number
}

export type TrechoBruto = {
  texto: string
  url: string
  titulo: string | null
  publicadoEm: string | null
}

export type RespostaDoExa = {
  trechos: TrechoBruto[]
  /** `costDollars.total` da resposta. Zero quando o Exa não informa. */
  custoDolares: number
}

export async function buscarNoExa(
  consulta: ConsultaAoExa,
  chave: string | undefined = process.env.EXA_API_KEY,
): Promise<RespostaDoExa> {
  if (!chave) throw new ExaSemCredito()

  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS)

  let resposta: Response
  try {
    resposta = await fetch(ENDERECO, {
      method: 'POST',
      headers: { 'x-api-key': chave, 'Content-Type': 'application/json' },
      signal: controle.signal,
      body: JSON.stringify({
        query: consulta.texto,
        // O que faz a busca ser semântica: o Exa reescreve a pergunta em vez de
        // casar palavra. Sem isto, o resultado é o site institucional — a única
        // fonte que garantidamente NÃO tem a dor.
        useAutoprompt: true,
        type: 'auto',
        numResults: consulta.numeroDeResultados ?? 5,
        startPublishedDate: consulta.publicadoDepoisDe,
        ...(consulta.dominios.length > 0 ? { includeDomains: consulta.dominios } : {}),
        // `highlights` e não `text`: o texto inteiro custa mais e ainda teria
        // que ser recortado aqui. O highlight já é o trecho que casou.
        contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } },
      }),
    })
  } catch {
    // Timeout e falha de rede são a mesma coisa para quem chama: tente depois.
    // O erro original não é propagado de propósito: ele carrega a URL com a
    // chave em alguns runtimes, e este objeto vai parar em `error_logs`.
    throw new ExaIndisponivel(0)
  } finally {
    clearTimeout(relogio)
  }

  if (resposta.status === 401 || resposta.status === 402) throw new ExaSemCredito()
  if (resposta.status === 429 || resposta.status >= 500) throw new ExaIndisponivel(resposta.status)
  if (!resposta.ok) {
    throw new ExaRecusou(resposta.status, (await resposta.text()).slice(0, 300))
  }

  const bruto = (await resposta.json()) as RespostaBruta
  return {
    trechos: (bruto.results ?? []).flatMap(achatarTrechos),
    custoDolares: Number(bruto.costDollars?.total ?? 0) || 0,
  }
}

/**
 * Um resultado do Exa pode trazer vários highlights. Cada um vira um trecho
 * candidato, com a MESMA url — e é `extrairSinais` quem depois garante um sinal
 * por fonte.
 */
function achatarTrechos(r: ResultadoBruto): TrechoBruto[] {
  const url = r.url
  if (!url) return []
  const pedacos = (r.highlights ?? []).filter((h) => typeof h === 'string' && h.trim())
  const base = { url, titulo: r.title ?? null, publicadoEm: r.publishedDate ?? null }
  if (pedacos.length === 0) {
    return r.text?.trim() ? [{ ...base, texto: r.text }] : []
  }
  return pedacos.map((texto) => ({ ...base, texto }))
}
