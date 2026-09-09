import { diaEmSaoPaulo } from '@/lib/tasks/buckets'

/**
 * A parte do orçamento que não fala com ninguém.
 *
 * ## Por que puro, e por que num arquivo só
 *
 * Mesmo desenho de `trial.ts`/`trial-queries.ts` e de `google-ads.ts`: o
 * `'use server'` de `actions.ts` e o `server-only` das queries **impedem o
 * teste de importar o módulo**, e a conta de prazo é justamente o que precisa
 * de teste — ela envolve fuso, e fuso é onde este projeto já se enganou.
 *
 * ## O recorte que este arquivo implementa
 *
 * Medido em 56 concorrentes que anunciam proposta (07/09/2026):
 *
 *     43%  PDF
 *      4%  VALIDADE / vencimento
 *      0%  AVISO de que o prazo esta acabando
 *
 * O que quase ninguém faz é avisar. É o que o motor daqui já sabe fazer, então
 * é aqui que o recurso é diferente em vez de ser o 37º gerador de proposta.
 */

/** `date` do Postgres e `<input type="date">` falam o mesmo dialeto. */
export type DiaISO = string

/**
 * Quantos dias ANTES do vencimento a cobrança aparece.
 *
 * Dois, e não zero: cobrar no dia em que o orçamento morre é cobrar tarde —
 * não sobra tempo de ligar, renegociar e refazer. Dois dias é o menor prazo em
 * que ainda dá para fazer alguma coisa a respeito, e o maior que ainda soa
 * como "está vencendo" em vez de "vence algum dia".
 */
export const ANTECEDENCIA_DO_LEMBRETE_EM_DIAS = 2

/**
 * `-03:00` fixo, pelo mesmo motivo escrito em `fimDoDiaEmSaoPaulo`: o Brasil
 * aboliu o horário de verão em 2019, e se um dia voltar, os dois pontos ficam
 * lado a lado para corrigir.
 */
const OFFSET = '-03:00'

/** Hora em que a cobrança cai no dia dela. Começo de expediente, não madrugada. */
const HORA_DA_COBRANCA = '09:00:00'

/**
 * Soma (ou subtrai) dias de calendário a um `YYYY-MM-DD`.
 *
 * Ancorado em `Date.UTC` de propósito, como `diasEntre` em `buckets.ts`: somar
 * `n * 86_400_000` a um instante real dá 23 ou 25 horas em dia de mudança de
 * horário e escorrega o dia. O Brasil não tem mais horário de verão, mas a
 * conta não pode depender disso continuar valendo.
 */
export function somarDias(dia: DiaISO, n: number): DiaISO {
  const [ano, mes, d] = dia.split('-').map(Number)
  const base = Date.UTC(ano!, mes! - 1, d!)
  const movido = new Date(base + n * 86_400_000)

  const p = (v: number) => String(v).padStart(2, '0')
  return `${movido.getUTCFullYear()}-${p(movido.getUTCMonth() + 1)}-${p(movido.getUTCDate())}`
}

/**
 * Quando a tarefa de cobrar retorno deve vencer, em ISO com offset.
 *
 * A regra tem duas metades, e a segunda é a que impede um defeito visível:
 *
 *     caso normal    validade - 2 dias, as 09:00 de Sao Paulo
 *     ja passou      HOJE as 23:59:59 de Sao Paulo
 *
 * Sem a segunda, um orçamento que vale até amanhã nasceria com a cobrança
 * marcada para anteontem — e `/hoje` a exibiria como "atrasada há 2 dias" no
 * segundo em que foi criada. Tarefa que nasce atrasada ensina a pessoa a
 * ignorar o aviso de atraso, que é o único sinal que o produto tem.
 *
 * Empurrar para o fim do dia de hoje mantém a cobrança em "Hoje" (que é onde
 * ela precisa estar: o orçamento está morrendo) sem mentir que ela venceu.
 */
export function prazoDoLembrete(validade: DiaISO, agora: Date): string {
  const alvo = somarDias(validade, -ANTECEDENCIA_DO_LEMBRETE_EM_DIAS)
  const instante = `${alvo}T${HORA_DA_COBRANCA}${OFFSET}`

  if (new Date(instante).getTime() > agora.getTime()) return instante

  return `${diaEmSaoPaulo(agora)}T23:59:59${OFFSET}`
}

/**
 * Dias de calendário até o orçamento vencer. Negativo quando já venceu.
 *
 * Em dia de calendário e não em horas: para quem manda orçamento, "vence
 * amanhã" é uma informação de agenda, e 26 horas e 34 horas são as duas
 * "amanhã".
 */
export function diasAteVencer(validade: DiaISO, agora: Date): number {
  const hoje = diaEmSaoPaulo(agora)
  const [ay, am, ad] = hoje.split('-').map(Number)
  const [by, bm, bd] = validade.split('-').map(Number)

  return Math.round(
    (Date.UTC(by!, bm! - 1, bd!) - Date.UTC(ay!, am! - 1, ad!)) / 86_400_000,
  )
}

/**
 * O texto que a pessoa lê no card e na tarefa.
 *
 * "vence hoje" e não "vence em 0 dias", porque zero dia não é uma quantidade
 * que alguém diz em voz alta — e é justamente o dia em que a frase precisa ser
 * lida sem tradução.
 */
export function textoDoPrazo(validade: DiaISO, agora: Date): string {
  const dias = diasAteVencer(validade, agora)

  if (dias < -1) return `venceu há ${Math.abs(dias)} dias`
  if (dias === -1) return 'venceu ontem'
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

/**
 * Título máximo de `tasks.title`, espelhado de `taskSchema`.
 *
 * A tarefa daqui é INSERIDA direto, sem passar por `taskSchema` (ela não vem
 * de formulário). O teto continua valendo: quem edita essa tarefa depois abre
 * o `TaskFormDialog`, que valida com o schema — um título de 240 caracteres
 * gravado aqui faria a edição recusar o valor que o próprio produto escreveu.
 */
const TETO_DO_TITULO = 200

const PREFIXO = 'Cobrar retorno do orçamento — '

/**
 * O título da tarefa de retorno.
 *
 * Carrega o nome do negócio porque `/hoje` mostra uma lista de tarefas de
 * empresas diferentes: cinco linhas dizendo só "Cobrar retorno do orçamento"
 * não dizem qual orçamento, e a pessoa teria que abrir uma por uma.
 */
export function tituloDoLembrete(tituloDoNegocio: string): string {
  const inteiro = PREFIXO + tituloDoNegocio.trim()
  if (inteiro.length <= TETO_DO_TITULO) return inteiro

  return inteiro.slice(0, TETO_DO_TITULO - 1).trimEnd() + '…'
}
