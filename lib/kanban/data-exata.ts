/**
 * Data, dia da semana e hora, para o Kanban ler sem fazer conta.
 *
 * ## Por que o tempo relativo saiu
 *
 * O board escrevia "parado há 3 semanas", "há 1 mês", "amanhã", "hoje". Cada
 * um desses obriga quem lê a reconstruir a data de cabeça antes de agir — e
 * quem abre o funil está decidindo para quem ligar HOJE, com uma agenda ao
 * lado. "Quarta, 14:30" entra na agenda; "em 3 dias" tem que virar quarta
 * primeiro.
 *
 * Pedido do dono em 16/09, e a troca é de REPRESENTAÇÃO: nenhum cálculo de
 * vencimento, de negócio parado ou de próxima ação mudou. `estadoDeMovimento`,
 * `urgenciaDoParado` e `urgenciaDaProximaAcao` continuam decidindo o que é
 * urgente; o que muda é o texto que sai na tela.
 *
 * ## O fuso é declarado, e isso não é detalhe
 *
 * O servidor da Vercel roda em UTC. Sem `timeZone` explícito, o mesmo
 * instante sairia "19 de abril, 17:30" no servidor e "19 de abril, 14:30" no
 * cliente — descasamento de hidratação, e pior, o cliente veria a hora errada
 * por um quadro. Com o fuso fixo, servidor e navegador produzem exatamente a
 * mesma string, e nenhuma destas funções precisa do relógio do cliente.
 *
 * Brasil não tem horário de verão desde 2019, a mesma premissa que
 * `lib/tasks/buckets.ts` e `lib/dashboard/periodo.ts` já usam.
 *
 * ## Duas formas, a mesma ordem
 *
 * A longa é para o painel de detalhe, onde há largura. A curta é para o card,
 * que tem 288px — "19 de abril • quarta-feira • 14:30" quebraria em três
 * linhas num card de quatro. A ordem dos campos e o separador são os mesmos
 * nas duas, e é isso que faz as duas serem a mesma convenção.
 */

const FUSO = 'America/Sao_Paulo'

/** O separador, num lugar só para as duas formas não divergirem. */
const PONTO = ' • '

function partes(iso: string, opcoes: Intl.DateTimeFormatOptions) {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...opcoes }).format(data)
}

/**
 * `19 de abril • quarta-feira • 14:30`
 *
 * Devolve `null` para data inválida, e quem chama não renderiza a linha. É a
 * mesma decisão de `dueDateInfo` no dashboard, que já pagou o defeito de
 * imprimir "vence em NaN dias" quando a string não era data.
 */
export function dataExata(iso: string | null | undefined): string | null {
  if (!iso) return null

  const dia = partes(iso, { day: 'numeric', month: 'long' })
  const semana = partes(iso, { weekday: 'long' })
  const hora = partes(iso, { hour: '2-digit', minute: '2-digit', hour12: false })
  if (!dia || !semana || !hora) return null

  return [dia, semana, hora].join(PONTO)
}

/**
 * `19 abr • qua • 14:30`
 *
 * A forma do card. Mesma ordem, mesmo separador, mesmos campos — só os nomes
 * abreviados.
 *
 * Duas limpezas que o `pt-BR` exige, e as duas foram achadas pelo teste:
 *
 * - o **ponto** de "abr." e "qua." sai. Com dois pontos finais numa linha de
 *   22 caracteres, eles competem com o separador e a linha fica picotada.
 * - o **"de"** sai. `{ day: 'numeric', month: 'short' }` em pt-BR devolve
 *   "19 de abr.", não "19 abr." — a preposição sobrevive à abreviação do mês,
 *   e num card ela custa três caracteres sem dizer nada.
 */
export function dataExataCurta(iso: string | null | undefined): string | null {
  if (!iso) return null

  const dia = partes(iso, { day: 'numeric', month: 'short' })
  const semana = partes(iso, { weekday: 'short' })
  const hora = partes(iso, { hour: '2-digit', minute: '2-digit', hour12: false })
  if (!dia || !semana || !hora) return null

  return [enxugar(dia), enxugar(semana), hora].join(PONTO)
}

/** Tira o ponto da abreviação e o "de" que o pt-BR mantém em "19 de abr.". */
function enxugar(s: string): string {
  return s.replace(/\./g, '').replace(/^(\d+) de /, '$1 ')
}

/**
 * A data de um campo `date` do Postgres, que NÃO tem hora.
 *
 * `deals.due_date` é `date`, não `timestamptz`. Escrever "00:00" ali seria
 * inventar uma hora que ninguém marcou — e hora inventada num prazo é pior
 * que hora ausente, porque a pessoa pode agendar em cima dela.
 *
 * Constrói em horário LOCAL de propósito: `new Date('2026-04-19')` é meia-noite
 * UTC, e em São Paulo isso é 21h do dia 18. O mesmo cuidado que
 * `dueDateInfo` no dashboard já toma.
 */
export function dataExataSemHora(diaYyyyMmDd: string | null | undefined): string | null {
  if (!diaYyyyMmDd) return null

  const casa = /^(\d{4})-(\d{2})-(\d{2})/.exec(diaYyyyMmDd.trim())
  if (!casa) return null

  const ano = Number(casa[1])
  const mes = Number(casa[2])
  const dia = Number(casa[3])
  const data = new Date(ano, mes - 1, dia)

  // Duas armadilhas de uma vez, e as duas já custaram defeito visível neste
  // produto:
  //
  // - **31/02** existe como string e não existe no calendário: o `Date`
  //   empurra em silêncio para março, e a tela mostraria um dia que a pessoa
  //   nunca escolheu.
  // - **ano de dois dígitos** ("0026-08-09"): `new Date(26, ...)` remapeia 26
  //   para 1926, e foi assim que o dashboard chegou a exibir "atrasado há
  //   46.000 dias". A volta pelo `getFullYear` recusa os dois.
  const real =
    data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia
  if (!real) return null

  const formatar = (o: Intl.DateTimeFormatOptions) =>
    enxugar(new Intl.DateTimeFormat('pt-BR', o).format(data))

  return [
    formatar({ day: 'numeric', month: 'short' }),
    formatar({ weekday: 'short' }),
  ].join(PONTO)
}
