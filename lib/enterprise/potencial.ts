/**
 * O potencial do Radar, do jeito que cabe num card do Kanban.
 *
 * ## Por que um texto NOVO, e não a justificativa recortada
 *
 * A `justificativa` de `avaliarEvento` é uma frase por sinal, emendadas — ótima
 * no Radar, onde há espaço, e ilegível num card de 288px. Cortá-la no meio
 * mostraria "Página pública do evento informada para confer…", que é o sinal
 * MENOS útil dos seis. Aqui cada sinal vira um rótulo de duas ou três
 * palavras, e só os que ajudam a decidir quem abordar primeiro entram.
 *
 * ## Percentual, e o que ele NÃO é
 *
 * O dono pediu o número em porcentagem (22/10). Ele continua sendo a mesma
 * prioridade de 0 a 100 de `avaliarEvento`: soma de sinais verificáveis, não
 * chance de fechar. Por isso o rótulo diz "potencial", e não "chance".
 */

export type EventoDoRadar = {
  prioridade: number | null
  data_inicio: string
  organizador: string | null
  contato_email: string | null
  contato_telefone: string | null
  publico_estimado: number | null
}

export type PotencialNoCard = {
  /** 0 a 100. */
  percentual: number
  /** No máximo três rótulos, separados por " · ". */
  resumo: string
}

/** `hoje` é `AAAA-MM-DD` em São Paulo. */
export function potencialNoCard(evento: EventoDoRadar, hoje: string): PotencialNoCard {
  const sinais: string[] = []

  const dias = Math.round(
    (Date.parse(`${evento.data_inicio}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000,
  )
  if (dias < 0) sinais.push('Evento já passou')
  else if (dias === 0) sinais.push('Evento é hoje')
  else sinais.push(dias === 1 ? 'Falta 1 dia' : `Faltam ${dias} dias`)

  if (evento.contato_email?.trim() || evento.contato_telefone?.trim()) sinais.push('Contato direto')
  else sinais.push('Sem contato')

  const publico = evento.publico_estimado ?? 0
  if (publico >= 1000) sinais.push(`Público ${Math.floor(publico / 1000)} mil+`)
  else if (publico >= 100) sinais.push('Público 100+')
  else if (evento.organizador?.trim()) sinais.push('Organizador identificado')

  return {
    percentual: Math.max(0, Math.min(100, Math.round(evento.prioridade ?? 0))),
    resumo: sinais.slice(0, 3).join(' · '),
  }
}

/**
 * Qual evento representa o contato quando há mais de um.
 *
 * Um organizador (Fenaco, OAB) faz vários eventos por ano, e todos apontam para
 * o MESMO contato. O card mostra o de maior potencial que ainda vai acontecer;
 * só cai num que já passou se não sobrar nenhum futuro.
 */
export function eventoQueRepresenta<T extends EventoDoRadar>(eventos: T[], hoje: string): T | null {
  if (eventos.length === 0) return null
  const futuros = eventos.filter((e) => e.data_inicio >= hoje)
  const base = futuros.length > 0 ? futuros : eventos
  return [...base].sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0))[0] ?? null
}
