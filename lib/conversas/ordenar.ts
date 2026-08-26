/**
 * A ordem da lista de conversas, e a cor do relógio.
 *
 * ## A decisão que separa esta tela de todo concorrente
 *
 * Kommo, Agendor, SleekFlow e todo aplicativo de mensagem ordenam por
 * **mensagem mais recente**. É a ordem certa para CONVERSAR.
 *
 * Não é a ordem certa para NÃO PERDER VENDA, que é o que este produto promete.
 * Medido no mercado brasileiro em 2026:
 *
 *     5    minutos é o tempo que o cliente considera ideal
 *     40%  desistem da compra se não responderem em 10 minutos
 *     62%  já desistiram de comprar por falha operacional, quase sempre demora
 *     34%  mantêm o WhatsApp aberto o tempo todo
 *
 * Então a lista ordena por **quem está esperando há mais tempo**. Quem já foi
 * respondido desce, mesmo que a mensagem dele seja a mais recente da tela.
 *
 * ## Por que isso mora aqui, e não numa cláusula SQL
 *
 * O `order by` do banco resolve a ordenação, e resolve mesmo — o índice
 * `conversas_espera_idx` existe exatamente para isso. Mas a decisão de **qual
 * cor o relógio tem** e de **o que conta como esperando** é regra de produto, e
 * regra de produto que só vive numa string SQL não tem teste.
 *
 * Aqui ela tem, e cada caso documenta o defeito que ele impede.
 */

/** Cinco minutos. O que o cliente brasileiro considera resposta rápida. */
export const MINUTOS_ATENCAO = 5

/** Dez minutos. A partir daqui, 40% já desistiram. */
export const MINUTOS_URGENTE = 10

export type ConversaParaOrdenar = {
  id: string
  /** Quando chegou a última mensagem deles. */
  ultimoRecebidoEm: string | null
  /** `null` = ninguém respondeu ainda. */
  respondidaEm: string | null
  /** Última mensagem nossa, usada para desempatar entre as já respondidas. */
  ultimoEnviadoEm: string | null
}

/** Quão urgente é responder. Vira cor na tela. */
export type Urgencia = 'respondida' | 'tranquila' | 'atencao' | 'urgente'

/**
 * Há quantos minutos esta pessoa está esperando.
 *
 * Devolve `null` para quem não está esperando: conversa já respondida, ou que
 * nunca recebeu mensagem. Contador em quem não espera é ruído, e ruído treina
 * a pessoa a ignorar o número — mesma razão pela qual o contador de `/hoje`
 * some quando é zero.
 */
export function minutosEsperando(
  conversa: ConversaParaOrdenar,
  agora: Date = new Date(),
): number | null {
  if (!conversa.ultimoRecebidoEm) return null
  if (conversa.respondidaEm) return null

  const chegou = new Date(conversa.ultimoRecebidoEm)
  if (Number.isNaN(chegou.getTime())) return null

  const minutos = (agora.getTime() - chegou.getTime()) / 60_000

  // Relógio adiantado do lado do cliente, ou data no futuro por dado torto.
  // Zero em vez de negativo: "esperando há -3 minutos" é pior que impreciso,
  // é visivelmente quebrado.
  return minutos < 0 ? 0 : minutos
}

export function urgenciaDaConversa(
  conversa: ConversaParaOrdenar,
  agora: Date = new Date(),
): Urgencia {
  const minutos = minutosEsperando(conversa, agora)
  if (minutos === null) return 'respondida'
  if (minutos >= MINUTOS_URGENTE) return 'urgente'
  if (minutos >= MINUTOS_ATENCAO) return 'atencao'
  return 'tranquila'
}

/**
 * A lista, na ordem em que ela salva venda.
 *
 * 1. Esperando primeiro, e dentro delas a **mais antiga no topo**.
 * 2. Depois as respondidas, mais recente primeiro.
 *
 * O passo 1 é contraintuitivo de propósito: em lista de chat o mais novo sobe.
 * Aqui o mais VELHO sobe, porque é ele que está prestes a desistir.
 *
 * Não muta a entrada.
 */
export function ordenarPorEspera<T extends ConversaParaOrdenar>(conversas: T[]): T[] {
  const esperando: T[] = []
  const respondidas: T[] = []

  for (const c of conversas) {
    // Sem `ultimoRecebidoEm` a conversa não está esperando ninguém: é uma que
    // nós começamos e o cliente ainda não respondeu.
    if (c.ultimoRecebidoEm && !c.respondidaEm) esperando.push(c)
    else respondidas.push(c)
  }

  esperando.sort((a, b) => tempo(a.ultimoRecebidoEm) - tempo(b.ultimoRecebidoEm))

  respondidas.sort((a, b) => maisRecente(b) - maisRecente(a))

  return [...esperando, ...respondidas]
}

function tempo(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const t = new Date(iso).getTime()
  // Data ilegível vai para o fim da fila de espera em vez de embaralhar tudo:
  // `NaN` em comparador produz ordem indefinida, e uma linha torta não pode
  // custar a ordem das outras.
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

/** O evento mais recente de uma conversa já respondida, para desempatar. */
function maisRecente(c: ConversaParaOrdenar): number {
  const enviado = c.ultimoEnviadoEm ? new Date(c.ultimoEnviadoEm).getTime() : 0
  const recebido = c.ultimoRecebidoEm ? new Date(c.ultimoRecebidoEm).getTime() : 0
  const a = Number.isNaN(enviado) ? 0 : enviado
  const b = Number.isNaN(recebido) ? 0 : recebido
  return Math.max(a, b)
}

/**
 * O relógio, escrito como uma pessoa falaria.
 *
 * Nunca em segundos: "esperando há 43 segundos" cobra uma precisão que não
 * ajuda a decidir, e some rápido demais para ser lido.
 */
export function textoDoRelogio(minutos: number): string {
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `${Math.floor(minutos)} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas}h`

  const dias = Math.floor(horas / 24)
  return dias === 1 ? '1 dia' : `${dias} dias`
}

/**
 * Quantas conversas estão esperando resposta.
 *
 * É o número do contador na barra lateral. Igual ao de `/hoje`: só aparece
 * quando há o que cobrar.
 */
export function quantasEsperando(conversas: ConversaParaOrdenar[]): number {
  return conversas.filter((c) => c.ultimoRecebidoEm && !c.respondidaEm).length
}
