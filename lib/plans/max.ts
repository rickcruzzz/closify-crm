import { MAX_PLAN_PRICE, PLANO_NA_TELA, type PlanoPago } from '@/lib/plans'

/**
 * O direito ao WhatsApp: uma decisão, um lugar.
 *
 * ## Por que isto é uma função pura e não um `if` na Server Action
 *
 * A pergunta "esta empresa pode mandar mensagem agora?" tem QUATRO respostas
 * negativas diferentes, e cada uma pede uma ação diferente de quem lê:
 *
 *     exige_max      nunca assinou   -> mostrar o plano
 *     max_vencido    assinou e caiu  -> reativar, sem repetir o argumento
 *     sem_conexao    pagou e não conectou -> ir para o QR
 *     conexao_caiu   conectou e caiu -> reconectar
 *
 * Um `if` espalhado por cada chamador produz quatro versões dessa árvore, e a
 * que diverge em silêncio é a que manda um cliente pagante para a tela de
 * vendas. É a armadilha já paga em 18/08: *"Seu Pro venceu, reative"* aparecia
 * para quem **nunca** teve Pro.
 *
 * ## E por que ela NÃO decide a leitura
 *
 * A seção 6 do desenho do Max é explícita: assinatura inativa bloqueia **ação
 * nova**, e preserva histórico, conversa, lead e mensagem. Quem parou de pagar
 * continua lendo o que já é dele.
 *
 * Isso não é generosidade. Uma caixa de entrada que some quando a cobrança
 * falha apaga, da tela do cliente, a conversa em que ele estava negociando —
 * e a primeira coisa que ele faz é voltar para o celular, que é exatamente o
 * hábito que este produto existe para desfazer. `podeLerConversas` devolve
 * `true` sempre, e tem teste travando isso.
 *
 * ## `maxVigente` vem da FUNÇÃO, nunca da coluna
 *
 * A doutrina travada desde a 0027 e repetida em seis migrations: regra de plano
 * lê `max_vigente()`, nunca `subscriptions.plano` nem `workspaces.plan`. A
 * coluna é o último valor gravado e não sabe que o tempo passou.
 *
 * `plano` entra aqui por um motivo só, e é o de cima: separar *"nunca assinou"*
 * de *"assinou e venceu"*. Ele decide a FRASE, nunca o acesso.
 */

/**
 * Em que estado está a conexão de WhatsApp da empresa.
 *
 * `desconhecido` existe porque a leitura do provedor pode falhar, e falha de
 * leitura não é desconexão: tratar as duas como a mesma coisa faria uma
 * indisponibilidade de terceiro virar "seu WhatsApp caiu" na tela de quem está
 * com tudo funcionando.
 */
export type EstadoDaConexao =
  /** Nunca foi conectada nesta empresa. */
  | 'ausente'
  /** O QR foi gerado e ainda não foi lido. */
  | 'conectando'
  | 'conectado'
  /** Já esteve conectada e caiu. */
  | 'desconectado'
  /** O provedor respondeu erro. */
  | 'erro'
  /** Não deu para saber. Nunca tratado como desconexão. */
  | 'desconhecido'

export type EstadoDaAssinatura = {
  /** `subscriptions.plano`, ou `null` quando não existe assinatura. */
  plano: PlanoPago | null
  /** O que `max_vigente()` respondeu. Nunca derivado de `plano`. */
  maxVigente: boolean
}

export type MotivoDoBloqueio =
  | 'exige_max'
  | 'max_vencido'
  | 'sem_conexao'
  | 'conexao_caiu'

export type DireitoAoWhatsapp =
  | { pode: true }
  | { pode: false; motivo: string; tipo: MotivoDoBloqueio }

/**
 * A empresa pode ENVIAR mensagem agora?
 *
 * A ordem das portas é a regra, e ela vai do mais caro para o mais barato de
 * resolver: primeiro o plano, depois a conexão. Invertida, quem nunca assinou
 * leria *"conecte seu WhatsApp"* e iria procurar um botão que não existe para
 * ele.
 */
export function direitoAoWhatsapp(
  assinatura: EstadoDaAssinatura,
  conexao: EstadoDaConexao,
): DireitoAoWhatsapp {
  if (!assinatura.maxVigente) {
    // `plano === 'max'` sem vigência quer dizer que já houve Max aqui. A frase
    // muda porque o argumento de venda já foi aceito uma vez, e repeti-lo para
    // quem só precisa pagar de novo é atrito no lugar errado.
    if (assinatura.plano === 'max') {
      return {
        pode: false,
        tipo: 'max_vencido',
        motivo:
          `Seu plano ${PLANO_NA_TELA.max} venceu. As conversas continuam aqui, ` +
          'e voltam a receber assim que o pagamento for confirmado.',
      }
    }

    return {
      pode: false,
      tipo: 'exige_max',
      motivo:
        `O WhatsApp dentro do CRM é do plano ${PLANO_NA_TELA.max}, ` +
        `R$ ${MAX_PLAN_PRICE} por mês pela empresa inteira.`,
    }
  }

  if (conexao === 'conectado') return { pode: true }

  // `desconhecido` e `erro` caem aqui como "caiu", e isso é escolha: quem já
  // conectou precisa de um caminho de volta, e oferecer reconexão a quem está
  // bem custa um clique, enquanto não oferecer a quem está fora custa a venda.
  if (conexao === 'ausente') {
    return {
      pode: false,
      tipo: 'sem_conexao',
      motivo: 'Conecte o WhatsApp da sua empresa em Configurações para começar a responder por aqui.',
    }
  }

  return {
    pode: false,
    tipo: 'conexao_caiu',
    motivo:
      conexao === 'conectando'
        ? 'O WhatsApp ainda está conectando. Leia o QR Code em Configurações para terminar.'
        : 'O WhatsApp desta empresa se desconectou. Reconecte em Configurações para voltar a responder.',
  }
}

/**
 * A empresa pode LER as conversas que já existem?
 *
 * Sempre. Ver o cabeçalho: bloquear ação nova é regra de cobrança, apagar
 * histórico da tela seria punição — e a punição cai justamente sobre a
 * conversa de venda que estava em andamento quando o boleto venceu.
 *
 * Existe como função, e não como ausência de checagem, porque ausência não tem
 * teste. O dia em que alguém "otimizar" pondo a leitura atrás do plano, o teste
 * que trava isto reprova e diz por quê.
 */
export function podeLerConversas(): boolean {
  return true
}
