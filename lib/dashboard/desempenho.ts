/**
 * As quatro medidas de desempenho do funil, e quando cada uma cala.
 *
 * ## A regra que governa o arquivo inteiro
 *
 * **Ausência de dado não é resultado ruim.** É a mesma lição que
 * `lib/dashboard/conversao.ts` registrou em 26/08: `0%` afirma que as vendas
 * fracassaram, quando a verdade é que nenhuma chegou ao fim. Aqui isso vira
 * tipo: cada medida devolve `null` quando não há base, e `null` na tela é a
 * medida sumindo, nunca um zero.
 *
 * ## O ciclo é aproximado, e a tela precisa dizer isso
 *
 * `dias_ate_fechar` vem de `stage_changed_at - created_at` nos negócios
 * fechados. `stage_changed_at` (0033) guarda a ÚLTIMA troca de etapa, não a
 * data de fechamento: para um negócio que foi fechado e nunca mais tocado, as
 * duas coincidem; para um reaberto e fechado de novo, o número conta até o
 * último fechamento. Não existe histórico de etapa neste schema — é a melhor
 * medida disponível, e chamá-la de "tempo médio de fechamento" sem ressalva
 * seria vender precisão que ela não tem.
 *
 * ## Por que o ticket médio exige TRÊS ganhos
 *
 * Com um único negócio ganho, "ticket médio" é o valor daquele negócio com
 * nome de estatística. Dois já são uma média de dois. O corte em três é
 * arbitrário e está escrito aqui para poder ser discutido — o que não é
 * arbitrário é existir um corte: média de amostra 1 lida como padrão da
 * empresa é exatamente o defeito dos "100% de conversão" de um negócio só.
 */

/** O que a RPC `get_funnel_performance` devolve, cru. */
export type DesempenhoCru = {
  valorGanho: number
  valorPerdido: number
  negociosGanhos: number
  negociosPerdidos: number
  ticketMedio: number | null
  diasAteFechar: number | null
}

export type MedidaDeDesempenho = {
  chave: 'ticket' | 'ciclo' | 'ganho' | 'perdido'
  rotulo: string
  /** Já formatado. A formatação de dinheiro fica com quem renderiza. */
  valor: number
  formato: 'dinheiro' | 'dias'
  /** A ressalva que impede o número de prometer mais do que mede. */
  nota?: string
}

/** Ganhos mínimos para o ticket médio deixar de ser "o valor daquele negócio". */
const GANHOS_PARA_TICKET = 3

export function medidasDeDesempenho(cru: DesempenhoCru): MedidaDeDesempenho[] {
  const medidas: MedidaDeDesempenho[] = []

  if (cru.ticketMedio !== null && cru.negociosGanhos >= GANHOS_PARA_TICKET) {
    medidas.push({
      chave: 'ticket',
      rotulo: 'Ticket médio',
      valor: cru.ticketMedio,
      formato: 'dinheiro',
      nota: `média de ${cru.negociosGanhos} vendas`,
    })
  }

  if (cru.diasAteFechar !== null && cru.negociosGanhos + cru.negociosPerdidos > 0) {
    medidas.push({
      chave: 'ciclo',
      rotulo: 'Tempo até fechar',
      valor: Math.round(cru.diasAteFechar),
      formato: 'dias',
      nota: 'aproximado, da criação ao fechamento',
    })
  }

  // Ganho e perdido entram SEMPRE que houve fechamento, mesmo valendo zero:
  // aqui o zero é informação de verdade ("fechou e não entrou dinheiro"), não
  // ausência. O que decide é a contagem, não o valor.
  if (cru.negociosGanhos > 0) {
    medidas.push({
      chave: 'ganho',
      rotulo: 'Ganho no período',
      valor: cru.valorGanho,
      formato: 'dinheiro',
      nota: `${cru.negociosGanhos} ${cru.negociosGanhos === 1 ? 'negócio' : 'negócios'}`,
    })
  }

  if (cru.negociosPerdidos > 0) {
    medidas.push({
      chave: 'perdido',
      rotulo: 'Perdido no período',
      valor: cru.valorPerdido,
      formato: 'dinheiro',
      nota: `${cru.negociosPerdidos} ${cru.negociosPerdidos === 1 ? 'negócio' : 'negócios'}`,
    })
  }

  return medidas
}
