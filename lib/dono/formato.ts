/**
 * Formatação da Central, em horário de Brasília.
 *
 * ## Por que o fuso é explícito em toda função daqui
 *
 * Este projeto já pagou essa armadilha: o servidor da Vercel roda em UTC, e às
 * 21h de São Paulo já é o dia seguinte lá — uma data formatada sem `timeZone`
 * mostra o dia errado por três horas todo dia
 * (ver `lib/tasks/buckets.ts`, que existe por causa disso).
 *
 * A Central roda em localhost, onde o fuso da máquina por acaso é o certo. Mas
 * "por acaso" não é garantia: o mesmo código lido numa máquina configurada em
 * outro fuso mostraria outra data, e uma tela que informa dinheiro não pode
 * depender da configuração do relógio de quem olha.
 */

const FUSO = 'America/Sao_Paulo'

const dinheiro = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const dataCurta = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dataComHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatarDinheiro(valor: number): string {
  return dinheiro.format(valor)
}

export function formatarData(iso: string | null): string {
  if (!iso) return '-'
  return dataCurta.format(new Date(iso))
}

export function formatarDataComHora(iso: string | null): string {
  if (!iso) return '-'
  return dataComHora.format(new Date(iso))
}

/**
 * "hoje", "ontem", "há 5 dias" — a leitura que o olho faz sem calcular.
 *
 * Numa tela de monitoramento, a pergunta quase nunca é "em que dia foi", é "faz
 * quanto tempo". `18/08/2026` obriga a subtrair de cabeça; "há 2 dias" não.
 * A data exata continua disponível no `title` de quem precisar.
 */
export function formatarTempoRelativo(iso: string | null): string {
  if (!iso) return 'nunca'

  const diferenca = Date.now() - new Date(iso).getTime()
  const minutos = Math.floor(diferenca / 60_000)

  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas}h`

  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`

  const meses = Math.floor(dias / 30)
  if (meses === 1) return 'há 1 mês'
  return `há ${meses} meses`
}
