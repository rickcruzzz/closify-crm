import { dealStageLabels, dealStages, type DealStage } from '@/lib/deals/types'
import type { FunnelStageCount } from '@/lib/dashboard/queries'

/**
 * As linhas do funil, com a participação de cada etapa.
 *
 * ## O problema que este arquivo existe para resolver
 *
 * Medido em produção no workspace principal em 16/09/2026: **110 dos 132
 * negócios estão em "A contatar"**, 83% em uma etapa só. Num gráfico de barras
 * proporcionais isso significa uma barra cheia e cinco fios — as outras cinco
 * etapas somam 22 negócios e ficam, juntas, com menos de um quinto da largura.
 *
 * A etapa que o dono precisa olhar é justamente uma das cinco: "A contatar" é
 * fila de entrada, e "Negociação" é dinheiro decidindo. O desenho antigo dava
 * todo o espaço para a menos acionável.
 *
 * **A saída não é normalizar a escala** — escala mentirosa é pior que barra
 * fina, porque some com a informação de que uma etapa domina, que é um fato
 * real do negócio. A saída é a barra deixar de ser o portador do número: cada
 * linha carrega contagem, valor e percentual em TEXTO, e a barra vira só a
 * leitura periférica. Com o número escrito, uma barra de 4% continua
 * informando.
 *
 * `MINIMO_VISIVEL` fecha a outra metade: 1 de 132 daria 0,75% de largura, que
 * arredonda para zero pixel e lê como "etapa vazia". Etapa com negócio dentro
 * sempre desenha alguma coisa.
 */

/** Largura mínima da barra, em %, para etapa que tem pelo menos um negócio. */
const MINIMO_VISIVEL = 2

export type LinhaDoFunil = {
  stage: DealStage
  label: string
  /** Quantos negócios na etapa. */
  quantidade: number
  /** Soma de `value` dos negócios da etapa. Pode ser 0 com quantidade > 0. */
  valor: number
  /** Participação da etapa na QUANTIDADE total, 0 a 100, uma casa. */
  participacao: number
  /** Largura da barra em %, já com o piso de visibilidade aplicado. */
  larguraDaBarra: number
}

export type ResumoDoFunil = {
  linhas: LinhaDoFunil[]
  /** Negócios em etapa não fechada. */
  abertos: number
  /** Soma de `value` das etapas não fechadas. */
  valorAberto: number
  /** Nenhum negócio em etapa nenhuma. */
  vazio: boolean
  /**
   * Quantos negócios abertos estão sem valor preenchido.
   *
   * Medido em produção: **119 de 132 negócios têm `value` zerado**. Sem este
   * número a coluna de valor mostraria "R$ 0" em quase toda linha e leria como
   * defeito do sistema, quando é campo em branco. A tela usa isto para dizer a
   * verdade em uma frase em vez de repetir zero seis vezes.
   */
  abertosSemValor: number
}

const FECHADAS: DealStage[] = ['fechado_ganho', 'fechado_perdido']

export function ehEtapaFechada(stage: DealStage): boolean {
  return FECHADAS.includes(stage)
}

/**
 * Monta as linhas na ordem canônica das etapas, inclusive as vazias.
 *
 * Etapa sem negócio continua na lista de propósito: sumir com ela mudaria a
 * forma do funil conforme o dado, e a pessoa perderia a referência de quantas
 * etapas existem. Ela aparece com zero e sem barra.
 */
export function montarFunil(
  contagens: FunnelStageCount[],
  abertosSemValor = 0,
): ResumoDoFunil {
  const porEtapa = new Map(contagens.map((c) => [c.stage, c]))
  const total = contagens.reduce((soma, c) => soma + c.count, 0)

  const linhas: LinhaDoFunil[] = dealStages.map((stage) => {
    const c = porEtapa.get(stage)
    const quantidade = c?.count ?? 0
    const bruto = total > 0 ? (quantidade / total) * 100 : 0

    return {
      stage,
      label: dealStageLabels[stage],
      quantidade,
      valor: c?.valor ?? 0,
      participacao: Math.round(bruto * 10) / 10,
      larguraDaBarra: quantidade === 0 ? 0 : Math.max(MINIMO_VISIVEL, bruto),
    }
  })

  const abertas = linhas.filter((l) => !ehEtapaFechada(l.stage))

  return {
    linhas,
    abertos: abertas.reduce((s, l) => s + l.quantidade, 0),
    valorAberto: abertas.reduce((s, l) => s + l.valor, 0),
    vazio: total === 0,
    abertosSemValor,
  }
}
