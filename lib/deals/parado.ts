import type { DealStage } from '@/lib/deals/types'

/**
 * A partir de quantos dias sem mudar de etapa um negócio conta como parado.
 *
 * Catorze é uma escolha, não uma medição: não existe dado de ciclo de venda
 * neste produto ainda para calibrar por etapa. Duas semanas é tempo suficiente
 * para um "vou pensar" virar esquecimento, e curto o bastante para o aviso
 * ainda valer alguma coisa.
 *
 * Quando houver histórico de etapa, isto vira média por etapa, uma proposta
 * enviada e um lead novo não têm o mesmo ritmo.
 */
export const DIAS_PARA_PARADO = 14

/** Etapas em que o negócio acabou. Negócio fechado não para: ele terminou. */
const FECHADAS: DealStage[] = ['fechado_ganho', 'fechado_perdido']

export function etapaFechada(stage: DealStage): boolean {
  return FECHADAS.includes(stage)
}

/**
 * Dias inteiros desde a última mudança de etapa.
 *
 * Conta em dias de calendário, não em blocos de 24 horas: quem moveu o card
 * ontem às 23h e olha hoje às 8h vê "1 dia", que é o que a pessoa entende. A
 * divisão por 86.400.000 diria "0" e o negócio pareceria movido agora.
 */
export function diasSemAndar(stageChangedAt: string, agora: Date): number {
  const desde = new Date(stageChangedAt)
  if (Number.isNaN(desde.getTime())) return 0

  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const diferenca = Math.round((dia(agora) - dia(desde)) / 86_400_000)

  return Math.max(0, diferenca)
}

export type EstadoDeMovimento = {
  parado: boolean
  dias: number
}

/**
 * Um negócio está parado se está aberto e não muda de etapa há tempo demais.
 *
 * "Aberto" importa: sem esse recorte, todo negócio ganho apareceria como
 * parado há meses, e as etapas fechadas são justamente as que mais acumulam
 * linha, então o aviso viraria ruído puro e a pessoa aprenderia a ignorá-lo.
 */
export function estadoDeMovimento(
  deal: { stage: DealStage; stage_changed_at: string },
  agora: Date,
): EstadoDeMovimento {
  const dias = diasSemAndar(deal.stage_changed_at, agora)

  if (etapaFechada(deal.stage)) {
    return { parado: false, dias }
  }

  return { parado: dias >= DIAS_PARA_PARADO, dias }
}

/**
 * ## `rotuloDeParado` foi REMOVIDA em 16/09
 *
 * Ela escrevia "parado há 3 semanas" / "há 1 mês", e o argumento dela era
 * bom: *"parado há 47 dias obriga a pessoa a fazer a conta; há 1 mês ela
 * sente"*. Só que a conta que importa não é essa. Quem abre o funil está
 * decidindo para quem ligar hoje, com a agenda ao lado, e "há 3 semanas"
 * precisa virar uma DATA antes de poder ser usada.
 *
 * O Kanban passou a escrever o instante exato (`lib/kanban/data-exata.ts`), e
 * com isso nenhum chamador sobrou. Ficar como export sem uso seria código
 * morto convidando alguém a ressuscitar a convenção antiga.
 *
 * **A fronteira de 30 dias dela NÃO se perdeu**: ela virou
 * `urgenciaDoParado`, em `lib/kanban/urgencia.ts`, que usa o mesmo corte para
 * decidir entre âmbar e vermelho. O que era unidade de texto virou grau de
 * alarme.
 */
