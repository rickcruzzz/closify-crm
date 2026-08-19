import type { TaskRow } from '@/lib/tasks/types'

/**
 * Ordena as tarefas de UM dia por quanto elas pedem ação, não por hora.
 *
 * ## O defeito que motivou isto
 *
 * A célula do modo Mês mostra no máximo 3 chips e resume o resto em "+N"
 * (`components/calendario/month-view.tsx`). O corte era `tarefas.slice(0, 3)`
 * sobre a ordem de `agruparTarefasPorDia`, que é **só cronológica** — e
 * cronológico não sabe o que já foi feito.
 *
 * Efeito real, achado num print do produto: um dia com três tarefas concluídas
 * de manhã e uma vencida à tarde mostrava as três concluídas (cinza, riscadas)
 * e escondia a vencida atrás de "+1". A tela que existe para lembrar do que
 * falta estava exibindo o que já acabou e ocultando o que cobra ação.
 *
 * ## A ordem
 *
 * 1. **Vencida** — prazo passou e ninguém concluiu. É a única que representa
 *    promessa quebrada, e nunca pode ficar fora dos 3 primeiros.
 * 2. **Pendente** — ainda vai acontecer.
 * 3. **Concluída** — já aconteceu. Continua no calendário de propósito (é o
 *    "o que aconteceu" do subtítulo da tela), mas cede o lugar visível.
 *
 * Dentro de cada faixa, a hora volta a mandar, que é o que faz um dia ser
 * legível como agenda.
 *
 * Comparar INSTANTE e não dia é a mesma regra de `urgenciaDaProximaAcao` e de
 * `classificar` (`lib/tasks/buckets.ts`): tarefa marcada para as 9h com 15h no
 * relógio está vencida, mesmo sendo do mesmo dia.
 *
 * Devolve um array NOVO — ordenar no lugar mutaria o array guardado no `Map`
 * de `agruparTarefasPorDia`, que é memoizado e reusado pelos modos Semana e
 * Agenda, onde esta ordem não se aplica (os dois mostram o dia inteiro, sem
 * corte, então cronológico puro é o certo lá).
 */
export function ordenarPorRelevancia(tarefas: TaskRow[], agora: Date): TaskRow[] {
  return [...tarefas].sort((a, b) => {
    const faixaA = faixa(a, agora)
    const faixaB = faixa(b, agora)
    if (faixaA !== faixaB) return faixaA - faixaB

    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
  })
}

/** Menor vem primeiro. Números, e não strings, para o `sort` comparar direto. */
function faixa(task: TaskRow, agora: Date): 0 | 1 | 2 {
  if (task.done_at) return 2
  return new Date(task.due_at).getTime() < agora.getTime() ? 0 : 1
}
