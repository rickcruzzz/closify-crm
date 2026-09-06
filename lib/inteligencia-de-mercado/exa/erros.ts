/**
 * Os erros do Exa, nomeados.
 *
 * Nomear importa porque cada um pede uma reação diferente do chamador: sem
 * crédito PARA de vez, indisponível tenta de novo depois, recusado é defeito
 * nosso na consulta. Um `Error` genérico faria os três virarem "falhou" e a
 * fila continuaria batendo numa porta fechada.
 */

export class ExaSemCredito extends Error {
  readonly nome = 'ExaSemCredito' as const
  constructor() {
    super('Exa: sem crédito ou chave sem saldo')
  }
}

export class ExaIndisponivel extends Error {
  readonly nome = 'ExaIndisponivel' as const
  constructor(readonly status: number) {
    super(`Exa: indisponível (HTTP ${status})`)
  }
}

export class ExaRecusou extends Error {
  readonly nome = 'ExaRecusou' as const
  constructor(readonly status: number, readonly detalhe: string) {
    super(`Exa: recusou a consulta (HTTP ${status})`)
  }
}

/** Vale tentar de novo mais tarde? */
export function ehTransitorio(erro: unknown): boolean {
  return erro instanceof ExaIndisponivel
}
