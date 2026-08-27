/**
 * Qual negócio a tarefa criada na página do Contato já nasce ligada.
 *
 * ## O defeito que isto fecha
 *
 * `getProximaAcaoPorNegocio` (`lib/tasks/queries.ts`) só enxerga tarefa com
 * `deal_id`, e a página do Contato **nunca mandava `deal_id`**: passava
 * `leadId={lead.id}` e nada mais. Quem agendava por lá criava uma tarefa que o
 * painel do negócio jamais mostraria — e o painel então oferecia o único
 * caminho que conhece, "Agendar", produzindo uma segunda tarefa para o mesmo
 * compromisso.
 *
 * Medido no banco de produção em 27/08/2026: **zero** tarefa aberta sem
 * `deal_id` cujo contato tenha negócio. Ou seja, o defeito é **latente** — vira
 * real na primeira vez que alguém agendar pelo Contato, que é uma coisa normal
 * de fazer. Foi o momento mais barato de consertar: nenhum dado para migrar.
 *
 * ## Por que só sugere quando há UM
 *
 * Com um negócio aberto, a ligação é óbvia e deixar o campo vazio empurra para
 * a pessoa uma decisão que só tem uma resposta. Com dois ou mais, escolher por
 * ela erraria **calado**: a tarefa apareceria no negócio errado e o certo
 * continuaria dizendo "Nenhuma agendada", que é o defeito de origem com outra
 * roupa.
 *
 * Com nenhum, não há o que ligar — a tarefa continua sendo só do contato, que
 * é um uso legítimo (`tasks_alvo_minimo`, migration 0029, exige lead **ou**
 * negócio, não os dois).
 */

export type NegocioParaTarefa = {
  id: string
  title: string
}

export function negocioSugerido(negociosAbertos: NegocioParaTarefa[]): string | null {
  return negociosAbertos.length === 1 ? negociosAbertos[0].id : null
}

/**
 * O texto que explica o campo, escrito para quem lê — não a mesma frase para
 * os três casos.
 *
 * Com vários negócios a pessoa precisa saber que a escolha é dela e que não
 * escolher é aceitável; com um só, precisa saber que já veio preenchido, senão
 * o valor aparece do nada e ela desconfia dele.
 */
export function textoDoCampoDeNegocio(negociosAbertos: NegocioParaTarefa[]): string | null {
  if (negociosAbertos.length === 0) return null
  if (negociosAbertos.length === 1) {
    return 'A tarefa aparece como próxima ação deste negócio.'
  }
  return 'Escolha em qual negócio esta tarefa aparece como próxima ação.'
}
