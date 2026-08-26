import type { TaskBucket, TaskRow } from '@/lib/tasks/types'

/**
 * O fuso do usuário do Velo Funil, não o do servidor.
 *
 * A Vercel roda em UTC. `new Date().toISOString().slice(0, 10)` numa função de
 * servidor devolve o dia UTC, que às 21h de São Paulo já é o dia SEGUINTE.
 * Sem isto, toda tarefa marcada para hoje à noite apareceria no grupo "Depois",
 * que é o pior lugar possível para ela.
 */
const FUSO = 'America/Sao_Paulo'

const formatador = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * O dia do calendário em São Paulo, como `YYYY-MM-DD`.
 *
 * Via `formatToParts` e não `format`, porque o formato de saída de `format`
 * depende dos dados de locale do runtime, e o Node do servidor e o navegador
 * do usuário não são o mesmo runtime. As partes vêm nomeadas e não dependem
 * de ordem nenhuma.
 */
export function diaEmSaoPaulo(instante: Date): string {
  const partes = formatador.formatToParts(instante)
  const pegar = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? ''

  return `${pegar('year')}-${pegar('month')}-${pegar('day')}`
}

/**
 * O último instante do dia corrente em São Paulo, em ISO com offset.
 *
 * Serve a quem pergunta "o que vence até o fim de hoje?" — o badge da barra
 * lateral e as consultas de intervalo do calendário, que já montavam esta
 * string à mão.
 *
 * `-03:00` fixo, e não um cálculo de offset: o Brasil aboliu o horário de
 * verão em 2019, então Brasília não muda mais de offset. Se um dia voltar,
 * este é o ponto único a corrigir, em vez de várias strings espalhadas.
 */
export function fimDoDiaEmSaoPaulo(instante: Date): string {
  return `${diaEmSaoPaulo(instante)}T23:59:59-03:00`
}

/**
 * Distância em dias de calendário entre dois `YYYY-MM-DD`.
 *
 * Reancorado em `Date.UTC` de propósito: subtrair dois instantes reais daria
 * 23 ou 25 horas em dia de mudança de horário e a divisão por 86.400.000
 * arredondaria errado. O Brasil não tem mais horário de verão, mas a conta não
 * pode depender disso continuar valendo.
 */
function diasEntre(de: string, para: string): number {
  const [ay, am, ad] = de.split('-').map(Number)
  const [by, bm, bd] = para.split('-').map(Number)
  const a = Date.UTC(ay!, am! - 1, ad!)
  const b = Date.UTC(by!, bm! - 1, bd!)

  return Math.round((b - a) / 86_400_000)
}

/**
 * Em qual grupo da tela /hoje uma tarefa cai.
 *
 * "Atrasada" compara INSTANTE, não dia: tarefa marcada para as 9h quando já
 * são 15h está atrasada, mesmo sendo do mesmo dia. Agrupar por dia mandaria
 * ela para "Hoje" e a pessoa não veria que já furou o compromisso.
 */
export function classificar(task: TaskRow, agora: Date): TaskBucket {
  const vencimento = new Date(task.due_at)

  if (vencimento.getTime() < agora.getTime()) return 'atrasada'

  const dias = diasEntre(diaEmSaoPaulo(agora), diaEmSaoPaulo(vencimento))

  if (dias <= 0) return 'hoje'
  if (dias <= 7) return 'semana'
  return 'depois'
}

/**
 * Agrupa as tarefas nos quatro grupos, cada um ordenado do mais urgente ao
 * menos.
 *
 * Tarefa concluída não pertence a grupo nenhum e é descartada aqui também,
 * apesar de a consulta já filtrar, esta função é a única regra escrita sobre
 * o assunto, e quem chamar com a lista errada merece o resultado certo.
 *
 * ## A exceção, e por que ela precisa existir
 *
 * `/hoje` deixa a tarefa recém-concluída visível por alguns segundos, riscada,
 * com um "Desfazer" ao lado. Para riscar, o item precisa de `done_at`; para
 * aparecer, precisa estar num grupo. As duas coisas se anulavam aqui, e o
 * resultado era a linha sumir no instante do clique — reportado pelo dono como
 * "clico e some instantaneamente".
 *
 * `manterConcluidas` é a exceção dita em voz alta, em vez de a tela contornar
 * a regra por fora. Quem não passa nada continua tendo o comportamento de
 * sempre.
 */
export function agruparPorPrazo(
  tasks: TaskRow[],
  agora: Date,
  /** Ids que continuam agrupados mesmo concluídos. */
  manterConcluidas?: ReadonlySet<string>,
): Record<TaskBucket, TaskRow[]> {
  const grupos: Record<TaskBucket, TaskRow[]> = {
    atrasada: [],
    hoje: [],
    semana: [],
    depois: [],
  }

  for (const task of tasks) {
    if (task.done_at && !manterConcluidas?.has(task.id)) continue
    grupos[classificar(task, agora)].push(task)
  }

  for (const bucket of Object.keys(grupos) as TaskBucket[]) {
    grupos[bucket].sort(
      (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
    )
  }

  return grupos
}

/**
 * Rótulo relativo curto, para a linha da tarefa e para o card do Kanban.
 *
 * Fala em dia de calendário, não em horas corridas: "amanhã" é o que a pessoa
 * entende, e "em 19 horas" obriga ela a fazer a conta.
 *
 * `doneAt` não é opcional por capricho: sem ele, tarefa CONCLUÍDA continuava
 * anunciando o atraso do prazo original. Em produção havia uma marcada para
 * `2000-11-11` (ano digitado errado) que, já concluída, exibia "atrasada há
 * 9411 dias". Prazo de tarefa feita é história, não cobrança, e número absurdo
 * na tela faz a pessoa duvidar do resto dos números.
 */
export function rotuloDePrazo(
  dueAt: string,
  agora: Date,
  doneAt?: string | null,
): string {
  const vencimento = new Date(dueAt)

  if (doneAt) {
    const conclusao = new Date(doneAt)
    const dias = diasEntre(diaEmSaoPaulo(agora), diaEmSaoPaulo(conclusao))
    if (dias === 0) return 'concluída hoje'
    if (dias === -1) return 'concluída ontem'
    // Só o passado importa aqui: `done_at` é gravado pelo servidor no
    // instante da conclusão, nunca cai no futuro.
    return `concluída há ${-dias} dias`
  }

  const dias = diasEntre(diaEmSaoPaulo(agora), diaEmSaoPaulo(vencimento))

  if (vencimento.getTime() < agora.getTime()) {
    if (dias === 0) return 'atrasada hoje'
    const atraso = -dias
    return atraso === 1 ? 'atrasada há 1 dia' : `atrasada há ${atraso} dias`
  }

  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return `em ${dias} dias`
}
