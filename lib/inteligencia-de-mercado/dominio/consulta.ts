/**
 * Monta a busca semântica a partir do que o CRM já sabe do lead.
 *
 * ## Por que semântica e não palavra-chave
 *
 * `"LogiTech Transportes"` devolve o site institucional da empresa, que ela
 * mesma escreveu — exatamente a fonte que NÃO tem a dor. O que interessa está
 * em reclamação de cliente, notícia de contratação, post de fórum. Isso só
 * aparece perguntando pela INTENÇÃO, e é para isso que o `useAutoprompt` do
 * Exa existe.
 *
 * ## O domínio NÃO restringe a busca, e isso foi medido
 *
 * A primeira versão mandava `includeDomains: [dominio]`, limitando a busca ao
 * site da empresa. Medido contra a API real em 06/09/2026: **6 trechos do site
 * institucional produziram ZERO sinais**, enquanto a mesma pergunta sem filtro
 * de domínio trouxe duas reclamações no Reclame Aqui.
 *
 * Faz sentido depois de visto: o site é a única fonte que a empresa controla, e
 * ninguém publica a própria dor. A dor mora em reclamação, notícia e fórum —
 * exatamente o que o filtro excluía.
 *
 * O domínio continua entrando na consulta como TERMO, porque desambigua. Só não
 * cerca mais o resultado.
 *
 * ## O domínio vale mais que o nome, e por uma razão que já custou caro aqui
 *
 * Nome de empresa é ambíguo: "Ápice" existe em consultoria, em construção e em
 * clínica. Buscar por nome traz a homônima, e o resultado seria um insight
 * plausível sobre a empresa errada — a classe de erro mais cara deste projeto,
 * a mesma que produziu "6 de 9 clientes abandonaram" a partir de um filtro mal
 * escrito. O domínio do site é único; quando existe, ele manda.
 */

/** O mínimo que o módulo precisa saber. Ver `ports/leads.ts`. */
export type AlvoDeBusca = {
  nome: string
  empresa: string | null
  /** Domínio do site, sem protocolo. `null` quando o CRM não tem. */
  dominio: string | null
  /** Segmento declarado no onboarding, quando existe. */
  segmento: string | null
}

export type ConsultaMontada = {
  texto: string
  /**
   * Sempre vazio hoje. O campo fica porque o cliente do Exa o repassa e porque
   * há um uso legítimo à vista: buscar DENTRO de um portal de reclamação.
   * Restringir ao site da empresa é que está medido como errado — ver acima.
   */
  dominios: string[]
  /**
   * Só resultado publicado depois disto.
   *
   * Dor de dois anos atrás ou já foi resolvida ou não é notícia. E o custo de
   * ler o passado é o mesmo de ler o presente.
   */
  publicadoDepoisDe: string
}

export const JANELA_DE_BUSCA_MESES = 12

/**
 * `null` quando não há por onde buscar.
 *
 * Devolver uma consulta fraca seria pior que não buscar: gasta crédito do Exa
 * e devolve ruído que o extrator vai tentar transformar em dor.
 */
export function montarConsulta(
  alvo: AlvoDeBusca,
  agora: Date,
): ConsultaMontada | null {
  const empresa = alvo.empresa?.trim() || null
  const dominio = normalizarDominio(alvo.dominio)
  if (!empresa && !dominio) return null

  const referencia = dominio ?? empresa!
  const segmento = alvo.segmento?.trim()
  const contexto = segmento ? ` no setor de ${segmento}` : ''

  return {
    texto:
      `Reclamações de clientes, problemas relatados, contratações e captações ` +
      `recentes envolvendo ${referencia}${contexto}`,
    dominios: [],
    publicadoDepoisDe: mesesAtras(agora, JANELA_DE_BUSCA_MESES),
  }
}

/**
 * Tira protocolo, `www.`, caminho e porta.
 *
 * O CRM aceita o que a pessoa digitou, e ela digita de tudo:
 * `https://site.com.br/contato`, `www.site.com.br`, `site.com.br `. O filtro de
 * domínio do Exa só aceita o host puro — com qualquer sobra ele não casa com
 * nada e a busca volta vazia, sem erro nenhum.
 */
export function normalizarDominio(bruto: string | null | undefined): string | null {
  const limpo = bruto?.trim().toLowerCase()
  if (!limpo) return null

  const semProtocolo = limpo.replace(/^[a-z]+:\/\//, '')
  const host = semProtocolo.split('/')[0].split('?')[0].split('#')[0].split(':')[0]
  const semWww = host.replace(/^www\./, '')

  // Precisa ter ao menos um ponto e nada de espaço: "minha empresa" não é
  // domínio, e mandá-lo como filtro zeraria a busca em silêncio.
  if (!semWww.includes('.') || /\s/.test(semWww)) return null
  return semWww
}

function mesesAtras(agora: Date, meses: number): string {
  const d = new Date(agora)
  d.setMonth(d.getMonth() - meses)
  return d.toISOString().slice(0, 10)
}
