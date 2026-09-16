import { diaEmSaoPaulo } from '@/lib/tasks/buckets'
import { DIAS_PARA_PARADO } from '@/lib/deals/parado'

/**
 * Quanta atenção o card do Kanban deve pedir.
 *
 * Existe porque o board inteiro estava vermelho. `proxima-acao.tsx` tinha duas
 * cores — `text-destructive` ou `text-muted-foreground` — e usava a primeira
 * tanto para "tarefa atrasada" quanto para "sem próximo passo". Medido em
 * produção, 96% dos negócios abertos não têm próxima ação, então 100% dos
 * cards apareciam em alerta máximo. Alerta que aparece em tudo não distingue
 * nada: quem abre o Pipeline não sabe por onde começar, que é justamente o
 * trabalho que o Pipeline deveria fazer.
 *
 * Os três níveis:
 *
 * - `critico`  — promessa já quebrada: tarefa vencida, ou negócio congelado
 * - `atencao`  — o prazo é hoje, ou não há próximo passo marcado
 * - `neutro`   — tarefa no futuro, negócio andando
 */
export type Urgencia = 'critico' | 'atencao' | 'neutro'

export function urgenciaDaProximaAcao(dueAt: string, agora: Date): Urgencia {
  // Compara INSTANTE, não dia, mesma regra de `classificar` em
  // `lib/tasks/buckets.ts`: tarefa marcada para as 9h com 15h no relógio está
  // atrasada, mesmo sendo do mesmo dia.
  if (new Date(dueAt).getTime() < agora.getTime()) return 'critico'

  return diaEmSaoPaulo(new Date(dueAt)) === diaEmSaoPaulo(agora) ? 'atencao' : 'neutro'
}

/**
 * A urgência de um negócio SEM próxima ação.
 *
 * Negócio sem próximo passo é o que morre calado no funil, e essa é a
 * informação mais valiosa que o card pode dar. Mas ele não nasce `critico`:
 * quem acabou de criar o negócio ainda não errou nada, e pintar de vermelho no
 * primeiro minuto é o que fazia o board inteiro gritar.
 *
 * ## `etapaFechada` e `sabemosAData` entraram em 16/09, e cada um fecha um
 * ## defeito medido
 *
 * **Fechada devolve `neutro`.** `estadoDeMovimento` guarda `dias` mesmo em
 * etapa fechada, de propósito, e o card repassava esse número cru: um negócio
 * GANHO há 400 dias exibia alerta vermelho pedindo o próximo passo. A linha
 * "parado há N" já se protegia; o botão não tinha herdado a proteção. E as
 * fechadas são, pelo comentário de `parado.ts`, "as que mais acumulam linha" —
 * ou seja, o alarme falso aparecia justamente onde há mais cards.
 *
 * **Sem a data, também `neutro`.** O relógio nasce `null` no servidor (o
 * servidor roda em UTC e erraria a virada do dia em São Paulo), então o
 * primeiro quadro não sabe quantos dias passaram. Assumir zero pintava todo
 * card de âmbar e virava vermelho na hidratação: uma piscada de cor no board
 * inteiro. `neutro` é o que "ainda não sei" de fato significa.
 *
 * O `critico` continua sendo o negócio parado E sem próximo passo: dois sinais
 * na mesma direção, ninguém marcou o que fazer E ninguém mexeu nele.
 */
export function urgenciaSemProximaAcao(
  diasParado: number,
  opcoes: { etapaFechada?: boolean; sabemosAData?: boolean } = {},
): Urgencia {
  const { etapaFechada = false, sabemosAData = true } = opcoes
  if (etapaFechada || !sabemosAData) return 'neutro'
  return diasParado >= DIAS_PARA_PARADO ? 'critico' : 'atencao'
}

/** As classes de cor de cada nível, num lugar só para não divergirem. */
export const corDaUrgencia: Record<Urgencia, string> = {
  critico: 'text-destructive',
  // `amber-600` no claro e `amber-500` no escuro: o 500 sozinho não alcança
  // 4.5:1 sobre fundo claro, e o 600 fica abafado sobre o escuro.
  atencao: 'text-amber-600 dark:text-amber-500',
  neutro: 'text-muted-foreground',
}
