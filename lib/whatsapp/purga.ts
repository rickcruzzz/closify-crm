/**
 * A decisão da purga diária, pura.
 *
 * ## O que ela protege
 *
 * Instância no provedor é cobrança **recorrente**. Diferente de todo outro
 * recurso deste produto, uma linha esquecida aqui não ocupa espaço: ela emite
 * fatura, todo mês, para sempre.
 *
 * A 0090 fechou o lado da criação. Esta função fecha o da saída.
 *
 * ## Por que a decisão é separada do I/O
 *
 * Mesmo desenho de `lib/plans/trial.ts` e de `lib/dono/google-ads.ts`: a regra
 * tem três ramos e um limiar de dias, e regra que só vive dentro de uma rotina
 * que fala com o banco e com o provedor não tem teste nenhum.
 *
 * O que esta função NÃO faz é ir ao provedor. Ela responde o que fazer; quem
 * faz é `rodarPurgaDeInstancias`.
 */

/**
 * Sete dias sem Max antes de apagar.
 *
 * `max_vigente()` já inclui `dias_de_graca()`, que cobre a compensação bancária
 * de boleto e Pix. Quando ele cai, essa carência já correu.
 *
 * Estes sete são uma segunda carência, e ela existe por um custo que não é
 * financeiro: reconectar exige pegar o celular e ler um QR de novo. Cortar de
 * quem teve o cartão recusado numa terça e pagou na quinta transformaria um
 * atraso de dois dias em trabalho manual do cliente.
 *
 * Uma semana de uma instância custa cerca de R$ 23.
 */
export const DIAS_SEM_MAX_ATE_APAGAR = 7

export type DecisaoDaPurga =
  /** Primeira vez que vejo esta empresa sem Max. Marca a data e não apaga. */
  | 'marcar'
  /** Passou do prazo. Apaga no provedor e esquece a linha. */
  | 'apagar'
  /** Voltou a pagar. Limpa a marca. */
  | 'limpar'
  /** Nada a fazer. */
  | 'nada'

export type EstadoDaInstancia = {
  maxVigente: boolean
  /** ISO, ou `null` quando o plano está em dia. */
  semMaxDesde: string | null
}

/**
 * O que fazer com esta instância hoje.
 *
 * A ordem dos ramos importa: `maxVigente` decide primeiro, sempre. Ler a marca
 * antes faria uma empresa que voltou a pagar cair no ramo de apagar, porque a
 * marca velha ainda está lá e a data já passou.
 */
export function decidirPurga(estado: EstadoDaInstancia, agora: Date): DecisaoDaPurga {
  if (estado.maxVigente) {
    // ## O ramo que todo mundo esquece
    //
    // Sem ele, quem atrasa e volta a pagar carrega a marca antiga, e o próximo
    // atraso de UM dia soma com a espera do anterior: a instância morre por uma
    // conta que ninguém escreveu. É a mesma classe do `vigia_ultimo_aviso`, que
    // precisou de `sincronizarMemoria` nos DOIS caminhos em 09/09 — lá o efeito
    // foi um alarme preso por três dias.
    return estado.semMaxDesde ? 'limpar' : 'nada'
  }

  if (!estado.semMaxDesde) return 'marcar'

  const desde = new Date(estado.semMaxDesde).getTime()
  // Data ilegível NÃO apaga: remarcar custa mais sete dias de uma instância, e
  // apagar por engano custa o cliente parear o número de novo. O lado seguro de
  // errar é o barato, e aqui o barato é esperar.
  if (!Number.isFinite(desde)) return 'marcar'

  const dias = (agora.getTime() - desde) / (24 * 60 * 60 * 1000)
  return dias >= DIAS_SEM_MAX_ATE_APAGAR ? 'apagar' : 'nada'
}

/**
 * O resumo que a rotina devolve, para o cron poder dizer o que fez.
 *
 * Números e não booleano: "a purga rodou" não distingue o dia em que ela apagou
 * cinco instâncias do dia em que não havia nenhuma. A primeira é notícia.
 */
export type ResumoDaPurga = {
  conferidas: number
  marcadas: number
  apagadas: number
  limpas: number
  /** Instâncias que o provedor recusou apagar. Cada uma continua faturando. */
  falhas: number
}

export function resumoVazio(): ResumoDaPurga {
  return { conferidas: 0, marcadas: 0, apagadas: 0, limpas: 0, falhas: 0 }
}

/**
 * A purga merece um aviso ao dono?
 *
 * Só quando algo **saiu** ou quando algo falhou. Marcar e limpar são rotina: a
 * primeira acontece no dia seguinte a todo atraso de pagamento, e avisar nela
 * treinaria o dono a arquivar sem ler. É a regra do vigia de 01/09, e ela vale
 * aqui inteira: silêncio é resposta.
 *
 * Falha é diferente de rotina porque **custa dinheiro até alguém agir**: a
 * instância que o provedor recusou apagar continua na fatura do mês seguinte.
 */
export function mereceAviso(resumo: ResumoDaPurga): boolean {
  return resumo.apagadas > 0 || resumo.falhas > 0
}
