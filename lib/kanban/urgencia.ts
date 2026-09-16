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
 *
 * ## E em 16/09 o caso comum desceu de `atencao` para `neutro`
 *
 * A função nunca devolvia `neutro` para um negócio aberto, e havia um teste
 * travando isso — com o raciocínio de que "negócio sem próximo passo é o que
 * morre calado no funil". O raciocínio continua certo; a CONCLUSÃO era o
 * defeito, e só a medição mostrou.
 *
 * Medido no board de prova: **34 dos 42 cards, 81%, exibiam a linha âmbar
 * "Sem próximo passo"**. Isso não é um alerta aparecendo com frequência, é o
 * estado PADRÃO da base sendo pintado de alerta — e um alerta que vale para
 * oito de cada dez cards não ordena nada, que é exatamente o problema que este
 * arquivo existe para resolver, um degrau mais baixo de intensidade.
 *
 * O que mudou junto, e sem isso a mudança seria perda de informação: o card
 * passou a escrever **"Marcar próximo passo"** em vez de "Sem próximo passo"
 * quando o nível é `neutro`. A informação não sumiu — ela deixou de ser uma
 * acusação em cor e virou a ação que resolve o caso, que é o que a pessoa faz
 * com ela de qualquer jeito.
 *
 * `atencao` continua existindo e continua usado: é o nível de
 * `urgenciaDaProximaAcao` para tarefa que vence HOJE, que é o unico caso em
 * que âmbar significa "ainda dá tempo, mas hoje".
 */
export function urgenciaSemProximaAcao(
  diasParado: number,
  opcoes: { etapaFechada?: boolean; sabemosAData?: boolean } = {},
): Urgencia {
  const { etapaFechada = false, sabemosAData = true } = opcoes
  if (etapaFechada || !sabemosAData) return 'neutro'
  // `neutro` e nao `atencao`, desde 16/09. Ver o bloco acima: a ausencia de
  // proximo passo e o estado PADRAO do board, nao a excecao dele.
  return diasParado >= DIAS_PARA_PARADO ? 'critico' : 'neutro'
}

/**
 * Quanta atenção a linha "parado há N" deve pedir.
 *
 * ## O ramo âmbar existia e era inalcançável
 *
 * O card chamava `corDaUrgencia[urgenciaSemProximaAcao(dias)]` para pintar
 * esta linha, e o comentário de 16/09 registrou o defeito: a linha só
 * renderiza quando `dias >= DIAS_PARA_PARADO`, que é exatamente a condição de
 * `critico`, então o âmbar nunca acontecia. Era "uma constante vestida de
 * cálculo", e a correção daquele dia foi trocar a chamada por
 * `text-destructive` direto — honesta, e ela congelou a gradação em um nível
 * só.
 *
 * Medido no board de prova em 16/09: **21 dos 42 cards, metade da tela, com a
 * linha vermelha**. Vermelho em metade dos cards volta a ser o problema que
 * este arquivo inteiro existe para evitar, agora por outro caminho.
 *
 * ## A fronteira não foi inventada: ela já estava no texto
 *
 * `rotuloDeParado` trocava de unidade aos 30 dias — abaixo disso escrevia
 * "semanas", acima escrevia "meses". Duas semanas paradas é algo a olhar nesta
 * semana; dois MESES parado é negócio que provavelmente morreu, e a cor
 * passou a concordar com essa divisão.
 *
 * **Aquela função foi removida horas depois**, quando o Kanban trocou o tempo
 * relativo pela data exata. O limiar dela sobreviveu aqui, e é por isso que
 * esta explicação fica: sem ela, o 30 vira número mágico sem origem.
 */
export function urgenciaDoParado(dias: number): Urgencia {
  const MES = 30
  return dias >= MES ? 'critico' : 'atencao'
}

/** As classes de cor de cada nível, num lugar só para não divergirem. */
export const corDaUrgencia: Record<Urgencia, string> = {
  critico: 'text-destructive',
  // `amber-600` no claro e `amber-500` no escuro: o 500 sozinho não alcança
  // 4.5:1 sobre fundo claro, e o 600 fica abafado sobre o escuro.
  atencao: 'text-amber-600 dark:text-amber-500',
  neutro: 'text-muted-foreground',
}
