/**
 * Os 7 dias da semana (domingo a sábado) que contém `diaAncora`.
 *
 * Mesma convenção de início de semana que `grade-do-mes.ts` (domingo
 * primeiro), para o modo Semana não discordar do modo Mês sobre onde a
 * semana começa.
 */
export function diasDaSemana(diaAncora: string): string[] {
  const [ano, mes, dia] = diaAncora.split('-').map(Number) as [number, number, number]
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  const diaDaSemana = data.getUTCDay()

  const domingo = new Date(data)
  domingo.setUTCDate(data.getUTCDate() - diaDaSemana)

  const dias: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(domingo)
    d.setUTCDate(domingo.getUTCDate() + i)
    dias.push(d.toISOString().slice(0, 10))
  }
  return dias
}

const FORMATADOR_MES_CURTO = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  timeZone: 'UTC',
})

/**
 * "18 ago" — cabeçalho curto de uma coluna do modo Semana.
 *
 * O dia sai direto da string (sem `Intl`, que devolveria "18" com padding
 * questionável dependendo do runtime); só o mês passa pelo formatador, e o
 * "de" e o ponto finais são cortados — `Intl` em pt-BR devolve "ago." com
 * ponto, que sobra numa coluna estreita de sete.
 */
export function rotuloCurtoDoDia(diaYyyyMmDd: string): string {
  const [ano, mes, dia] = diaYyyyMmDd.split('-').map(Number) as [number, number, number]
  const mesCurto = FORMATADOR_MES_CURTO.format(new Date(Date.UTC(ano, mes - 1, 1))).replace(
    '.',
    '',
  )
  return `${dia} ${mesCurto}`
}
