/**
 * Camada 1 da resposta automática: decide SE responde e O QUE responde.
 *
 * Função pura, sem I/O e sem `server-only`, no mesmo desenho de
 * `atribuicao.ts` e `google-ads.ts`. O motivo é o de sempre aqui: o que fala
 * com cliente precisa de teste, e `server-only` impede o teste de importar.
 *
 * ## Por que existe uma camada SEM IA
 *
 * O agente SDR existe em `lib/sdr/` e continua desligado. Ele responde bem, e
 * o risco dele não é ser chato: é **prometer o que o produto não faz**. Esse
 * erro já aconteceu neste projeto escrito por gente, quando a landing dizia
 * "o sistema cobra o retorno" e cobrar significa dívida. Um modelo solto
 * dizendo "o sistema manda o follow-up pra você" mentiria para trinta
 * prospects antes de alguém notar.
 *
 * Esta camada só devolve **texto fixo**. Ela não decide conteúdo, decide
 * momento. O que ela compra é a única coisa que a conversa fria não perdoa:
 * ninguém fica esperando. A janela de resposta em abordagem fria é de
 * minutos, e o dono não está no celular às três da manhã.
 *
 * O que exige julgamento (preço, dúvida, objeção, desconfiança) continua indo
 * para a Camada 2, onde a IA redige e o dono aprova antes de sair.
 *
 * ## A ordem das checagens é a regra, não detalhe
 *
 * Cada porta abaixo fecha um jeito diferente de o sistema falar quando não
 * devia, e a ordem é do mais grave para o menos.
 */

/** Todo estado que a decisão precisa, e nada além disso. */
export type ContextoDaResposta = {
  /**
   * O interruptor, lido do ambiente pelo chamador.
   *
   * Sistema que fala com cliente e não tem botão de parar transforma um
   * defeito em trinta conversas estragadas. Ele é a primeira porta de
   * propósito: desligado, nenhuma outra regra precisa estar certa.
   */
  ligado: boolean
  /**
   * Se este número tem linha em `prospeccao_prospect`, ou seja, veio da fila.
   *
   * O webhook captura TODA mensagem recebida no número, não só resposta de
   * prospect. Quem escreve para o dono por outro motivo não pode receber
   * resposta de campanha.
   */
  ehProspect: boolean
  /**
   * Se a resposta foi escrita por robô, medido por `ehRespostaAutomatica`.
   *
   * No primeiro disparo real, 18 das 47 empresas responderam em 15 segundos
   * de média, e nenhuma era pessoa: eram chatbots de atendimento. Responder
   * um deles põe dois robôs trocando mensagem em laço, que é exatamente o
   * padrão que derruba número de WhatsApp.
   */
  ehRobo: boolean
  /** Se o texto pede para sair, por `pediuParaSair`. */
  pediuSair: boolean
  /**
   * Se o dono já escreveu nesta conversa, por `humanoAssumiu`.
   *
   * Depois que ele entra, o automático cala para sempre naquela conversa.
   * Os dois escrevendo por cima um do outro é pior que nenhum dos dois.
   */
  humanoAssumiu: boolean
  /** Se esta conversa já recebeu o aviso automático alguma vez. */
  jaAvisouNestaConversa: boolean
  /** Quantas respostas automáticas já saíram hoje, no número inteiro. */
  enviadasHoje: number
  /** O teto diário. Defesa contra laço, não regra de negócio. */
  tetoDiario: number
}

export type DecisaoDeResposta =
  | { responder: false; motivo: string }
  | { responder: true; texto: string; categoria: 'recebido' | 'saida' }

/**
 * O texto do aviso de recebimento.
 *
 * Curto de propósito. Ele não vende, não explica e não promete: só diz que
 * chegou e que alguém vem. Qualquer frase a mais aqui é conteúdo que ninguém
 * revisou indo para um estranho.
 */
export const TEXTO_RECEBIDO = 'Opa, recebi! Ja te respondo direito em instantes.'

/**
 * A confirmação de quem pediu para sair.
 *
 * Ela sai mesmo com o interruptor desligado, e isso é decisão: a primeira
 * mensagem promete em texto que não voltamos a procurar, e confirmar o
 * descadastro é a única parte dessa promessa que o outro lado consegue ver.
 * Calar aqui parece que o pedido se perdeu, e pedido que parece perdido vira
 * denúncia.
 */
export const TEXTO_SAIDA = 'Certo, nao te procuro mais. Obrigado por avisar!'

export function decidirResposta(c: ContextoDaResposta): DecisaoDeResposta {
  // Opt-out ANTES do interruptor. Ver o comentário de `TEXTO_SAIDA`: é a
  // única resposta que o dono prometeu por escrito, e promessa não tem
  // interruptor. Ela também não conta no teto diário, pelo mesmo motivo.
  if (c.pediuSair && c.ehProspect && !c.ehRobo) {
    return { responder: true, texto: TEXTO_SAIDA, categoria: 'saida' }
  }

  if (!c.ligado) return { responder: false, motivo: 'desligado' }

  // Não é da fila: é gente escrevendo para o dono por outro motivo.
  if (!c.ehProspect) return { responder: false, motivo: 'fora da fila' }

  // Robô. Ver o comentário de `ehRobo`.
  if (c.ehRobo) return { responder: false, motivo: 'resposta automatica do outro lado' }

  // O dono assumiu. O automático não volta nesta conversa.
  if (c.humanoAssumiu) return { responder: false, motivo: 'humano assumiu' }

  // Uma vez por conversa. Repetir "ja te respondo" a cada mensagem é o que
  // faz a pessoa perceber que está falando com máquina.
  if (c.jaAvisouNestaConversa) return { responder: false, motivo: 'ja avisou' }

  // O teto é defesa contra laço, não regra de negócio: se algo começar a
  // responder sozinho em série, ele para no fim do dia em vez de no fim da
  // lista. Por isso `>=` e não `>`.
  if (c.enviadasHoje >= c.tetoDiario) return { responder: false, motivo: 'teto diario' }

  return { responder: true, texto: TEXTO_RECEBIDO, categoria: 'recebido' }
}
