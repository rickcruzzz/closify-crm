/**
 * A escada de entrega de uma mensagem, e o que a Z-API diz sobre ela.
 *
 * ## Por que a escada só anda para FRENTE
 *
 * Webhook entrega fora de ordem. É normal `READ` chegar antes de `RECEIVED`
 * quando a pessoa abre o WhatsApp no instante em que a mensagem cai, e é normal
 * um reenvio trazer de volta um `SENT` que já foi superado há minutos.
 *
 * Sem a regra, o `update` mais recente vence e a tela regride de "lida" para
 * "entregue". Isso **apaga informação verdadeira**: saber que o cliente leu é o
 * dado que decide se o silêncio dele é falta de interesse ou falta de aviso, e
 * é exatamente o que este produto existe para responder.
 *
 * ## O defeito que esta função existe para não repetir
 *
 * Em 12/09, `proximoEstagio` da prospecção tinha o mesmo formato e um buraco:
 * a ordenação deixava dois valores de fora, `indexOf` devolvia `-1` para eles,
 * e **qualquer estágio comum ficava "maior" que `OPTED_OUT`**. Na prática a
 * pessoa pedia para sair e a mensagem seguinte a arrastava de volta, em
 * silêncio, porque `-1` não parece erro.
 *
 * Aqui nenhum `-1` entra em comparação: valor fora da escada devolve o atual,
 * explicitamente, e um caso de teste confere que TODO status conhecido está na
 * escada ou é tratado à parte.
 */

/**
 * Os quatro degraus, em ordem. `falhou` fica FORA de propósito: ele não é um
 * degrau, é uma saída.
 */
export const ESCADA_DE_ENTREGA = ['pendente', 'enviada', 'entregue', 'lida'] as const

export type DegrauDeEntrega = (typeof ESCADA_DE_ENTREGA)[number]

/** O que `mensagens.status` aceita depois da migration 0090. */
export type StatusDaMensagem = DegrauDeEntrega | 'falhou'

/**
 * O que um `MessageStatusCallback` da Z-API significa aqui.
 *
 * Devolve `null` quando não há o que gravar, e os dois motivos são diferentes:
 *
 *     desconhecido   status que a Z-API passou a mandar e ninguem mapeou.
 *                    Gravar um palpite poria um valor fora do `check` da 0090,
 *                    e a linha inteira seria recusada com 23514
 *     READ_BY_ME     conhecido, e NAO e sobre a nossa mensagem
 *
 * `READ_BY_ME` diz que **nós** lemos algo que nos mandaram. A escada aqui
 * descreve o caminho da mensagem que sai: mapeá-lo para `lida` afirmaria que o
 * cliente leu quando quem leu foi o vendedor, e é justamente essa a distinção
 * que faz a tela valer alguma coisa.
 *
 * `PLAYED` é de áudio e conta como leitura: o Brasil manda 4x mais áudio que
 * qualquer outro país, e um áudio ouvido é um áudio visto.
 */
export function statusDaZapi(status: string | null | undefined): StatusDaMensagem | null {
  switch (status) {
    case 'SENT':
      return 'enviada'
    // `RECEIVED` na Z-API é "chegou no aparelho dele", e não "ele respondeu".
    // O nome engana em português; o comportamento é o do segundo tique cinza.
    case 'RECEIVED':
      return 'entregue'
    case 'READ':
    case 'PLAYED':
      return 'lida'
    default:
      return null
  }
}

/**
 * O status que a mensagem passa a ter, dado o que já tinha e o que chegou.
 *
 * Nunca regride, e `falhou` é terminal nas duas direções:
 *
 *     atual falhou    fica falhou. Uma mensagem que nao saiu nao tem
 *                     `external_id`, entao nenhum callback de status casa com
 *                     ela — e se casar, a contradicao merece ser preservada,
 *                     nao apagada
 *     novo falhou     manda sempre. E a unica informacao que vem do NOSSO
 *                     lado, e ela sabe algo que o provedor nao sabe: a chamada
 *                     nem aconteceu
 */
export function proximoStatusDeEntrega(
  atual: StatusDaMensagem,
  novo: StatusDaMensagem,
): StatusDaMensagem {
  if (atual === 'falhou') return 'falhou'
  if (novo === 'falhou') return 'falhou'

  const iAtual = ESCADA_DE_ENTREGA.indexOf(atual as DegrauDeEntrega)
  const iNovo = ESCADA_DE_ENTREGA.indexOf(novo as DegrauDeEntrega)

  // Nenhum `-1` entra em comparação. Valor fora da escada não pode ser lido
  // como "o menor de todos": foi assim que um pedido de saída foi desfeito pela
  // mensagem seguinte, em 12/09.
  if (iNovo < 0) return atual
  if (iAtual < 0) return novo

  return iNovo > iAtual ? novo : atual
}
