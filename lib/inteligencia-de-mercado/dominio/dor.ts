import { classificarSinal, normalizar, type Confianca, type TipoDeSinal } from './sinais'

/**
 * Transforma os trechos crus do Exa em sinais gravaveis, ou devolve lista
 * vazia — que é uma resposta legítima e a mais comum.
 *
 * ## A regra que impede o recurso de virar gerador de texto
 *
 * Todo sinal precisa de `fonteUrl`. Trecho sem link vira opinião da máquina, e
 * opinião da máquina sobre a empresa de um cliente é exatamente o que não pode
 * existir aqui. Com link, a pessoa confere em um clique e a responsabilidade
 * volta para a fonte.
 *
 * ## Só entra `alta`, e isso foi MEDIDO
 *
 * Medido contra a API real em 06/09/2026, no blog institucional da RD Station:
 * depois de fechar a armadilha circular, sobraram 3 sinais de confiança `media`
 * — e os três eram ruído puro ("acesse a nova edição dos panoramas", "um de
 * nossos especialistas vai entender seu negócio"). As expressões fracas
 * ("desafio", "dificuldade") são vocabulário padrão de material de marketing.
 *
 * Vale a mesma regra do sino, escrita em 02/09: *"só entra o que já provou
 * valer um e-mail; fila com lixo dentro ensina a ignorar a fila inteira"*. Três
 * linhas plausíveis e inúteis fazem a pessoa parar de ler a quarta, que seria a
 * boa.
 *
 * `media` continua existindo em `sinais.ts` porque a classificação é honesta
 * sobre a própria força — ela só não é gravada.
 *
 * ## E por que o resumo é RECORTE, não paráfrase
 *
 * O texto gravado sai do próprio highlight, cortado. Parafrasear introduziria
 * uma afirmação que ninguém escreveu — e o produto passaria a alegar coisas
 * sobre empresas reais. Recorte com aspas é citação; paráfrase é acusação.
 */

export type TrechoDoExa = {
  texto: string
  url: string
  titulo?: string | null
  publicadoEm?: string | null
}

export type SinalParaGravar = {
  tipo: TipoDeSinal
  confianca: Confianca
  resumo: string
  fonteUrl: string
  publicadoEm: string | null
}

export const RESUMO_MAX = 400
export const MAXIMO_DE_SINAIS = 5

export function extrairSinais(
  trechos: TrechoDoExa[],
  /**
   * A consulta que produziu estes trechos. Passar isto NÃO é opcional na
   * prática: sem ela, a palavra que eu pus na pergunta volta como prova.
   * Ver a nota sobre circularidade em `sinais.ts`.
   */
  consulta = '',
  maximo: number = MAXIMO_DE_SINAIS,
): SinalParaGravar[] {
  const vistos = new Set<string>()
  const out: SinalParaGravar[] = []

  for (const t of trechos) {
    if (out.length >= maximo) break
    if (!ehHttps(t.url)) continue

    const classificado = classificarSinal(t.texto, consulta)
    if (!classificado) continue
    // Ver a nota acima: `media` e a faixa do ruido institucional.
    if (classificado.confianca !== 'alta') continue

    // Uma fonte, um sinal. O Exa devolve vários highlights da MESMA página, e
    // sem isto a tela mostraria cinco linhas dizendo a mesma coisa — o tipo de
    // ruído que faz a pessoa parar de ler a lista inteira.
    if (vistos.has(t.url)) continue
    vistos.add(t.url)

    out.push({
      tipo: classificado.tipo,
      confianca: classificado.confianca,
      resumo: cortar(t.texto, RESUMO_MAX),
      fonteUrl: t.url,
      publicadoEm: dataValida(t.publicadoEm),
    })
  }

  // Alta antes de média: quem lê para de ler cedo, e o primeiro item é o que
  // decide se a pessoa confia no recurso.
  return out.sort((a, b) => peso(b.confianca) - peso(a.confianca))
}

function peso(c: Confianca): number {
  return c === 'alta' ? 2 : c === 'media' ? 1 : 0
}

/**
 * `https` obrigatório, e não é purismo: a fonte vira link clicável dentro do
 * produto, e `http` num app servido por HTTPS gera aviso de conteúdo misto.
 */
function ehHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Corta preservando o COMEÇO e sem partir palavra ao meio.
 *
 * Mesma razão do `cortarParaCaber` de `lib/erros/reportar.ts`: o que importa
 * vem primeiro. Aqui, o começo do highlight é onde o Exa pôs o trecho que casou
 * com a busca.
 */
export function cortar(texto: string, teto: number): string {
  const limpo = normalizar(texto)
  if (limpo.length <= teto) return limpo
  const bruto = limpo.slice(0, teto - 1)
  const ultimoEspaco = bruto.lastIndexOf(' ')
  return (ultimoEspaco > teto * 0.6 ? bruto.slice(0, ultimoEspaco) : bruto) + '…'
}

function dataValida(bruto: string | null | undefined): string | null {
  if (!bruto) return null
  const d = new Date(bruto)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
