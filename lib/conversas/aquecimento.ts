/**
 * A escada de aquecimento do número, pura e testável.
 *
 * ## Por que ela saiu de `remetente-zapi.ts`
 *
 * A regra sempre foi pura, mas morava num arquivo que importa
 * `credenciaisDaEmpresa`, e esse importa `server-only` — o que torna o módulo
 * inteiro impossível de carregar no Vitest. Resultado: a decisão que protege o
 * número do CLIENTE não tinha um único teste, enquanto o docstring dela dizia,
 * em texto, que errar aqui *"destrói o canal de vendas de quem pagou"*.
 *
 * Mesmo desenho de `lib/plans/trial.ts` e de `lib/dono/pendencias.ts`: o que
 * decide fica separado do que faz I/O, e só o primeiro é testado.
 *
 * ## A escada, e de onde ela vem
 *
 *     ate  7 dias    10 por hora
 *     ate 21 dias    20 por hora
 *     depois         30 por hora
 *
 * A Z-API é conexão não oficial: ela pareia o número do cliente como se fosse
 * um WhatsApp Web, e quem decide se aquele número continua existindo é a Meta.
 * O padrão que ela pune é volume súbito de número novo, e
 * `docs/mercado/limites-e-bloqueios.md` o registra como o primeiro dos quatro
 * que derrubam número.
 *
 * Os degraus vêm do comportamento que a Meta observa, não da capacidade do
 * provedor: o provedor aguentaria mais.
 */

const UMA_HORA = 60 * 60 * 1000
const UM_DIA = 24 * UMA_HORA

/** Os cortes da escada, em dias. Nomeados porque o teste lê os dois. */
export const DIAS_PRIMEIRO_DEGRAU = 7
export const DIAS_SEGUNDO_DEGRAU = 21

/**
 * Há quantos dias este número está conectado.
 *
 * `agora` é parâmetro para o teste não depender do relógio. O padrão mantém a
 * chamada de produção com um argumento só.
 */
export function diasDeConexao(conectadoEm: string | null, agora: Date = new Date()): number {
  if (!conectadoEm) return 0
  const inicio = new Date(conectadoEm).getTime()
  // Data ilegível conta como conexão NOVA, que é o lado seguro: o pior que
  // acontece é uma empresa antiga mandar devagar por uma hora, contra um
  // número novo mandando 30 e sendo derrubado.
  if (!Number.isFinite(inicio)) return 0
  return Math.max(0, Math.floor((agora.getTime() - inicio) / UM_DIA))
}

/** Quantas mensagens por hora este número aguenta hoje. */
export function tetoPorHora(conectadoEm: string | null, agora: Date = new Date()): number {
  const dias = diasDeConexao(conectadoEm, agora)
  if (dias < DIAS_PRIMEIRO_DEGRAU) return 10
  if (dias < DIAS_SEGUNDO_DEGRAU) return 20
  return 30
}

/**
 * Por que o teto é esse, na língua de quem lê.
 *
 * A frase diz o MOTIVO e não só o número: "10 por hora" sozinho lê como
 * limitação do produto, e é o contrário — é o produto protegendo o número da
 * empresa. Quem entende isso não pede para aumentar.
 */
export function explicacaoDoTeto(conectadoEm: string | null, agora: Date = new Date()): string {
  const dias = diasDeConexao(conectadoEm, agora)
  if (dias < DIAS_PRIMEIRO_DEGRAU) {
    return 'Número conectado há menos de uma semana: 10 mensagens por hora enquanto ele aquece. É o que protege o número de ser bloqueado pelo WhatsApp.'
  }
  if (dias < DIAS_SEGUNDO_DEGRAU) {
    return 'Número em aquecimento: 20 mensagens por hora até completar três semanas de uso.'
  }
  return 'Número aquecido: 30 mensagens por hora.'
}
