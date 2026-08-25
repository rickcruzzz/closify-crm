/**
 * A conexão diz que está viva. Ela está entregando?
 *
 * ## O buraco que isto fecha, medido duas vezes em 25/08
 *
 * O processo do Evolution vira zumbi: a camada HTTP responde, `/send/text`
 * funciona, `/instance/status` devolve `connected` — e o laço de eventos está
 * morto. Nenhuma mensagem entra, e **nada no sistema sabe disso**.
 *
 * Na primeira vez custou uma madrugada para descobrir. Na segunda, três horas
 * se passaram antes de alguém reparar. Com cliente pagante do outro lado, três
 * horas de silêncio é a venda que o produto existe para não perder.
 *
 * A conexão em `integration_connections` não ajuda: ela guarda o último estado
 * GRAVADO, e o zumbi não grava nada. Quem sabe a verdade é o fluxo — se chegou
 * evento, o laço está vivo; se parou de chegar, alguma coisa quebrou entre a
 * Meta e o nosso banco.
 *
 * ## Por que exigir fluxo anterior, e não só silêncio
 *
 * Empresa sem cliente ativo fica dias sem receber mensagem, e isso é normal.
 * Alertar por silêncio puro faria toda conexão nova virar alarme no dia
 * seguinte — e alarme falso não incomoda: ele **mata a fila inteira**. Este
 * projeto já pagou isso em `/dono/alertas`, onde 8 de 11 alertas eram ruído e
 * o efeito foi ninguém olhar mais a lista.
 *
 * Então a regra é: só alerta quem **já recebia e parou**. Sem evento nenhum na
 * história daquela conexão, o silêncio não prova nada.
 */

/**
 * Quantas horas de silêncio antes de avisar.
 *
 * Duas, decidido a partir do caso real: a queda de 25/08 durou três horas antes
 * de ser notada. Duas pega antes de virar prejuízo, e é longo o bastante para
 * não disparar no vazio normal de uma madrugada — ninguém manda mensagem para
 * uma empresa de serviço às 4h.
 */
export const HORAS_DE_SILENCIO_ATE_AVISAR = 2

export type ConexaoObservada = {
  workspaceId: string
  /** Estado gravado em `integration_connections`. */
  status: string
  /** ISO do evento mais recente daquela conexão, ou `null` se nunca houve. */
  ultimoEvento: string | null
}

export type Diagnostico = {
  workspaceId: string
  /** Há quantas horas o fluxo parou. */
  horasEmSilencio: number
}

/**
 * Quais conexões pararam de receber, entre as que dizem estar conectadas.
 *
 * Devolve só as que precisam de aviso. Quem chama grava o estado e manda o
 * e-mail — a decisão fica aqui, sem banco, para poder ser testada.
 */
export function conexoesQueParaamDeReceber(
  conexoes: ConexaoObservada[],
  agora: Date = new Date(),
  horasLimite: number = HORAS_DE_SILENCIO_ATE_AVISAR,
): Diagnostico[] {
  const diagnosticos: Diagnostico[] = []

  for (const conexao of conexoes) {
    // Só quem se diz conectado. `error` já está avisado, `disconnected` é
    // estado esperado de quem nunca ligou ou desligou de propósito — avisar
    // qualquer um dos dois seria repetir informação que a tela já mostra.
    if (conexao.status !== 'connected') continue

    // Nunca recebeu nada: pode ser conexão de hoje, pode ser empresa sem
    // movimento. Silêncio sem histórico não é sintoma.
    if (!conexao.ultimoEvento) continue

    const quando = new Date(conexao.ultimoEvento)
    if (Number.isNaN(quando.getTime())) continue

    const horas = (agora.getTime() - quando.getTime()) / 3_600_000

    // Data no futuro é relógio torto, não fluxo saudável nem parado. Ignorar é
    // mais seguro que tratar como silêncio de valor negativo.
    if (horas < 0) continue

    if (horas >= horasLimite) {
      diagnosticos.push({
        workspaceId: conexao.workspaceId,
        horasEmSilencio: Math.floor(horas),
      })
    }
  }

  return diagnosticos
}

/**
 * O texto que a pessoa lê na tela de Integrações.
 *
 * Diz o que fazer, não só o que houve. "Sua conexão caiu" sem próximo passo
 * transfere para o cliente o trabalho de adivinhar — e ele não tem como saber
 * que reconectar é o caminho.
 */
export function avisoDeFluxoParado(horas: number): string {
  return (
    `Sua conexão do WhatsApp está sem receber mensagem há ${horas} ` +
    `${horas === 1 ? 'hora' : 'horas'}. Ela aparece como conectada, mas as ` +
    'mensagens não estão entrando no funil. Desconecte e conecte de novo em ' +
    'Integrações para voltar a receber.'
  )
}
