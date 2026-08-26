/**
 * O percentual de "Viraram venda", junto com a base que ele esconde.
 *
 * ## O defeito que este arquivo fecha
 *
 * `conversionRate` é `ganhos / fechados`. Numa empresa com UM negócio fechado,
 * e ele ganho, o card mais visível do dashboard exibia **100%** — medido na
 * empresa de demonstração em 26/08/2026: 1 de 1.
 *
 * Não é número errado, é número sem contexto: 100% de um caso lê como
 * desempenho excepcional, e é só o primeiro negócio da pessoa. O mesmo vale do
 * outro lado, um único negócio perdido vira "0%" e parece catástrofe.
 *
 * E quando NADA foi fechado ainda, o card mostrava `0%`, que é pior: zero por
 * cento afirma que as vendas fracassaram, quando a verdade é que nenhuma
 * chegou ao fim. Ausência de dado não é resultado ruim.
 *
 * Os dois números da base já vinham do banco: `get_dashboard_counts` devolve
 * `closed_deals` e `won_deals`, e `getDashboardMetrics` descartava os dois
 * depois de dividir um pelo outro.
 */

/** O que o card mostra: o número grande e a linha que o sustenta. */
export type Conversao = {
  /** O percentual, ou um travessão quando não há o que calcular. */
  valor: string
  /** A base, sempre presente. É ela que impede o percentual de mentir. */
  base: string
}

/**
 * Monta o valor e a base a partir das contagens cruas.
 *
 * Nunca devolve percentual sozinho: quem chama não tem como exibir o número
 * sem a base ao lado, porque a base não é opcional no tipo.
 */
export function textoDaConversao(ganhos: number, fechados: number): Conversao {
  // Sem nenhum fechamento não existe taxa. Um travessão é lido como "ainda
  // não", e `0%` seria lido como "fracassou".
  if (fechados <= 0) {
    return { valor: '—', base: 'nenhum negócio fechado ainda' }
  }

  const percentual = Math.round((ganhos / fechados) * 100)
  const plural = fechados === 1 ? 'negócio fechado' : 'negócios fechados'

  return {
    valor: `${percentual}%`,
    base: `${ganhos} de ${fechados} ${plural}`,
  }
}
