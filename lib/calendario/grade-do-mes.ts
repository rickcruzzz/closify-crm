/**
 * A grade de 42 células (6 semanas × 7 dias) de um mês, com os dias do mês
 * anterior/seguinte que preenchem a primeira e a última semana.
 *
 * Reusada em dois lugares: o range picker do filtro de período
 * (`components/ui/date-range-picker.tsx`) e o modo Mês do calendário
 * (`components/calendario/month-view.tsx`) — mesmo cálculo, sem duplicar.
 * 6 semanas cobre qualquer mês possível (o pior caso, fevereiro começando no
 * sábado, ainda cabe em 5, mas 6 mantém a grade com altura fixa o ano
 * inteiro, sem "pular" de tamanho ao trocar de mês).
 *
 * Semana começa no domingo (`getUTCDay()` já usa esse índice nativamente),
 * mesmo padrão de calendário civil brasileiro.
 */
export type DiaDaGrade = {
  /** `YYYY-MM-DD`, mesmo formato que `diaEmSaoPaulo` devolve em todo o produto. */
  dia: string
  numeroDoDia: number
  ehDoMesCorrente: boolean
}

export function gradeDoMes(ano: number, mes: number): DiaDaGrade[] {
  // `Date.UTC` com dia 1 do mês: o dia da semana do primeiro dia decide
  // quantas células do mês anterior entram antes dele.
  const primeiroDia = new Date(Date.UTC(ano, mes - 1, 1))
  const diaDaSemanaDoPrimeiro = primeiroDia.getUTCDay()

  const celulas: DiaDaGrade[] = []
  const inicio = new Date(Date.UTC(ano, mes - 1, 1 - diaDaSemanaDoPrimeiro))

  for (let i = 0; i < 42; i++) {
    const data = new Date(inicio)
    data.setUTCDate(inicio.getUTCDate() + i)

    celulas.push({
      dia: data.toISOString().slice(0, 10),
      numeroDoDia: data.getUTCDate(),
      ehDoMesCorrente: data.getUTCMonth() === mes - 1 && data.getUTCFullYear() === ano,
    })
  }

  return celulas
}

/** Nomes curtos dos dias da semana, domingo primeiro — cabeçalho da grade. */
export const NOMES_DOS_DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const FORMATADOR_MES_ANO = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "Agosto de 2026", capitalizado — cabeçalho do mês exibido na grade. */
export function rotuloDoMes(ano: number, mes: number): string {
  const texto = FORMATADOR_MES_ANO.format(new Date(Date.UTC(ano, mes - 1, 1)))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const FORMATADOR_DIA_POR_EXTENSO = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  timeZone: 'UTC',
})

/** "Terça-feira, 18 de agosto" — cabeçalho de grupo do modo Agenda. */
export function rotuloDoDiaPorExtenso(diaYyyyMmDd: string): string {
  const [ano, mes, dia] = diaYyyyMmDd.split('-').map(Number) as [number, number, number]
  const texto = FORMATADOR_DIA_POR_EXTENSO.format(new Date(Date.UTC(ano, mes - 1, dia)))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const FORMATADOR_DIA_E_MES = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

/**
 * "17 a 23 de agosto" — cabeçalho do modo Semana.
 *
 * O cabeçalho mostrava a data crua (`Semana de 2026-08-17`): formato de banco
 * de dados vazando para a tela, no mesmo lugar onde o modo Mês já dizia
 * "Agosto de 2026" em português. Quem lê "2026-08-17" precisa traduzir.
 *
 * O mês aparece uma vez só quando a semana não cruza a virada ("17 a 23 de
 * agosto"), e duas quando cruza ("31 de agosto a 6 de setembro") — repetir o
 * mês sempre produziria "17 de agosto a 23 de agosto", que ninguém fala.
 */
export function rotuloDaSemana(primeiroDiaYyyyMmDd: string): string {
  const [ano, mes, dia] = primeiroDiaYyyyMmDd.split('-').map(Number) as [number, number, number]
  const inicio = new Date(Date.UTC(ano, mes - 1, dia))
  const fim = new Date(Date.UTC(ano, mes - 1, dia + 6))

  if (inicio.getUTCMonth() === fim.getUTCMonth()) {
    return `${inicio.getUTCDate()} a ${FORMATADOR_DIA_E_MES.format(fim)}`
  }

  return `${FORMATADOR_DIA_E_MES.format(inicio)} a ${FORMATADOR_DIA_E_MES.format(fim)}`
}

/** Um dia está dentro do intervalo [inicio, fim], inclusive nas duas pontas. */
export function diaEstaNoIntervalo(
  dia: string,
  inicio: string | null,
  fim: string | null,
): boolean {
  if (!inicio || !fim) return false
  const [menor, maior] = inicio <= fim ? [inicio, fim] : [fim, inicio]
  return dia >= menor && dia <= maior
}
