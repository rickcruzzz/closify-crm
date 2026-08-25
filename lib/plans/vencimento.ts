import { AVISAR_A_PARTIR_DE } from '@/lib/plans/trial'

/**
 * Até quando o plano vale, dito do jeito que a pessoa pergunta.
 *
 * ## O buraco que isto fecha
 *
 * Até 25/08 a tela de Cobrança **não mostrava em lugar nenhum** quando o Pro
 * vence. `getEstadoAssinatura` fazia `.select('status, asaas_subscription_id')`
 * e nunca lia `current_period_end`.
 *
 * O que aparecia era o vencimento da **fatura**, vindo do Asaas — outra
 * pergunta:
 *
 *     fatura.vencimento    quando a cobrança precisa ser paga
 *     validoAte            até quando o acesso continua funcionando
 *
 * A segunda é a que faz alguém abrir Configurações, e era a que faltava.
 *
 * ## Por que o limiar vem de `trial.ts`
 *
 * O mesmo número que decide o destaque aqui decide a tarja do trial e a janela
 * do cron de aviso. Eram três valores diferentes (3 na tarja, 2 no cron, nada
 * na tela), e a divergência não gerava erro em lugar nenhum: só fazia o produto
 * dizer uma coisa e o e-mail dizer outra. Diagnóstico de 25/08, achado 7.2.
 */

export type EstadoDoVencimento = {
  /** ISO de origem, para quem precisar formatar de outro jeito. */
  iso: string
  /** "24 de setembro de 2026". */
  dataPorExtenso: string
  /**
   * Dias de CALENDÁRIO restantes. Negativo quando já venceu.
   *
   * Calendário e não períodos de 24h, mesma razão de `diasDeCalendarioAte` no
   * cron: um plano que vence às 10h de amanhã está a 29 horas, e arredondar
   * para 2 faria a pessoa achar que tem mais tempo do que tem.
   */
  diasRestantes: number
  /** Passou da data. O acesso ainda pode existir pela graça da forma de pagamento. */
  vencido: boolean
  /** Está dentro da janela de aviso e merece destaque na tela. */
  destacar: boolean
}

/** O dia do calendário em São Paulo, como `2026-08-25`. */
function diaEmSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data)
}

/**
 * Traduz uma data de validade no que a tela precisa saber.
 *
 * Devolve `null` para entrada ausente ou ilegível: assinatura que nunca foi
 * paga tem `current_period_end` nulo, e é um estado legítimo — a tela
 * simplesmente não mostra a linha, em vez de mostrar "Invalid Date".
 */
export function estadoDoVencimento(
  validoAte: string | null | undefined,
  agora: Date = new Date(),
): EstadoDoVencimento | null {
  if (!validoAte) return null

  const fim = new Date(validoAte)
  if (Number.isNaN(fim.getTime())) return null

  const hoje = new Date(`${diaEmSaoPaulo(agora)}T00:00:00Z`).getTime()
  const dia = new Date(`${diaEmSaoPaulo(fim)}T00:00:00Z`).getTime()
  const diasRestantes = Math.round((dia - hoje) / (24 * 60 * 60 * 1000))

  return {
    iso: validoAte,
    dataPorExtenso: new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(fim),
    diasRestantes,
    vencido: diasRestantes < 0,
    // Vencido não "destaca": ele tem texto próprio, e pintar de laranja algo
    // que já passou confunde com o que ainda dá para evitar.
    destacar: diasRestantes >= 0 && diasRestantes <= AVISAR_A_PARTIR_DE,
  }
}

/**
 * A linha que aparece embaixo da data.
 *
 * Fala em dias, não em data repetida: quem já leu "vale até 24 de setembro"
 * quer saber se isso é longe ou perto, e "faltam 30 dias" responde sem obrigar
 * a fazer conta de cabeça.
 */
export function textoDeQuantoFalta(estado: EstadoDoVencimento): string {
  const { diasRestantes } = estado

  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes)
    return dias === 1 ? 'venceu ontem' : `venceu há ${dias} dias`
  }

  if (diasRestantes === 0) return 'vence hoje'
  if (diasRestantes === 1) return 'vence amanhã'

  return `faltam ${diasRestantes} dias`
}
