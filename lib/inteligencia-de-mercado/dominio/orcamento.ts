/**
 * O teto de gasto, e a decisão de re-enriquecer.
 *
 * ## Medido, não estimado
 *
 * Uma busca neural do Exa custou **US$ 0,007** na chamada de conferência da
 * credencial, em 06/09/2026 — valor devolvido pelo próprio `costDollars` da
 * resposta. É o número que este arquivo usa; quando o Exa mudar o preço, a
 * resposta muda junto e o teto continua valendo, porque é contado em centavos
 * gastos e não em número de buscas.
 *
 * ## Por que PARA em vez de degradar
 *
 * Estourar o teto e "continuar com menos resultados" é o pior dos dois mundos:
 * gasta e entrega pior. Parar é visível, tem causa nomeada, e o dono decide se
 * aumenta. A alternativa silenciosa é como o webhook do Asaas ficou
 * interrompido por dias sem ninguém saber.
 */

/** US$ 0,007 por busca neural, medido em 06/09/2026. */
export const CUSTO_POR_BUSCA_USD = 0.007

/**
 * Teto mensal por workspace, em centavos de real.
 *
 * R$ 30 dá cerca de 700 buscas ao câmbio de setembro/2026 — mais que suficiente
 * para o teto de 50 contatos do Free e para uma base Pro de porte normal. O
 * número existe para impedir acidente (um laço, uma reimportação de planilha),
 * não para racionar uso legítimo.
 */
export const TETO_MENSAL_CENTAVOS = 3000

/**
 * Quantos dias antes de consultar o mesmo lead de novo.
 *
 * Trinta porque sinal de mercado não muda de semana em semana, e porque o custo
 * de reperguntar é imediato enquanto o ganho é raro. Mudança de etapa fura essa
 * janela: quem entrou em "Proposta" mudou de contexto, e aí vale reperguntar.
 */
export const DIAS_ATE_REENRIQUECER = 30

export type EstadoDeGasto = {
  gastoNoMesCentavos: number
  tetoCentavos?: number
}

export type Veredito =
  | { pode: true }
  | { pode: false; motivo: 'teto_estourado'; gastoNoMesCentavos: number; tetoCentavos: number }

export function podeConsultar(estado: EstadoDeGasto): Veredito {
  const teto = estado.tetoCentavos ?? TETO_MENSAL_CENTAVOS
  if (estado.gastoNoMesCentavos >= teto) {
    return {
      pode: false,
      motivo: 'teto_estourado',
      gastoNoMesCentavos: estado.gastoNoMesCentavos,
      tetoCentavos: teto,
    }
  }
  return { pode: true }
}

export type EstadoDoLead = {
  /** `null` quando nunca foi consultado. */
  consultadoEm: Date | null
  /** Quando a etapa do negócio mudou pela última vez, se houver negócio. */
  etapaMudouEm?: Date | null
}

/**
 * Reconsultar agora?
 *
 * Nunca consultado sempre pode. Depois disso, ou passaram os 30 dias, ou a
 * etapa mudou DEPOIS da última consulta — nesse caso o contexto é outro e a
 * resposta antiga já não serve.
 */
export function deveReenriquecer(
  lead: EstadoDoLead,
  agora: Date,
  diasDeJanela: number = DIAS_ATE_REENRIQUECER,
): boolean {
  if (!lead.consultadoEm) return true

  const mudouDepois =
    lead.etapaMudouEm != null && lead.etapaMudouEm.getTime() > lead.consultadoEm.getTime()
  if (mudouDepois) return true

  const dias = (agora.getTime() - lead.consultadoEm.getTime()) / 86_400_000
  return dias >= diasDeJanela
}

/** Converte o `costDollars.total` da resposta do Exa em centavos de real. */
export function centavosDe(dolares: number, cotacaoDoReal: number): number {
  if (!Number.isFinite(dolares) || dolares < 0) return 0
  return Math.ceil(dolares * cotacaoDoReal * 100)
}
