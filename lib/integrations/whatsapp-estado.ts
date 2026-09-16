/**
 * Em que fase a integração de WhatsApp está.
 *
 * ## Por que isto existe
 *
 * A ponte não oficial (Evolution GO sobre `whatsmeow`, numa VPS da Hostinger)
 * **saiu de operação**. O destino é a WhatsApp Cloud API oficial, que depende
 * de CNPJ ativo, verificação do negócio e App Review — semanas, não dias.
 *
 * Entre as duas coisas existe uma janela em que o produto **não tem WhatsApp**,
 * e essa janela precisa ser dita em vez de escondida. Sem isto:
 *
 * - o botão "Conectar WhatsApp" chamaria um servidor que não resolve no DNS, e
 *   o cliente tomaria erro de rede sem entender o que fez de errado;
 * - o vigia de fluxo continuaria mandando "desconecte e conecte de novo em
 *   Integrações", instrução que hoje não leva a lugar nenhum.
 *
 * ## Uma constante, lida por todos
 *
 * A tela de Integrações, o vigia e a tela de Conversas leem daqui. Se cada uma
 * tivesse a própria cópia, o dia em que a Cloud API entrar exigiria lembrar de
 * três lugares — e é assim que nasce a tela que diz uma coisa enquanto o e-mail
 * diz outra (classe 7 do diagnóstico de 25/08).
 */

export type FaseDoWhatsapp =
  /** Ponte não oficial de pé. Foi o estado até 25/08/2026. */
  | 'evolution'
  /** Sem ponte: a VPS saiu e a API oficial ainda não foi aprovada. */
  | 'migrando'
  /**
   * Z-API, conexão por QR Code, **dentro do plano Max**. Desde 16/09/2026.
   *
   * Não é a volta do Evolution com outro nome, e a diferença que importa não é
   * o provedor: é que a conexão passou a ser **por empresa**, paga por empresa,
   * e com o direito checado em `max_vigente()` a cada envio. Antes havia uma
   * ponte só, do produto inteiro, e o gate era `pro_vigente()`.
   */
  | 'zapi'
  /** WhatsApp Cloud API oficial, aprovada e ligada. */
  | 'oficial'

/**
 * A fase de hoje.
 *
 * ## O que esta linha liga, e o que ela NÃO liga
 *
 * Ela diz que o produto TEM caminho de WhatsApp. Não diz que uma empresa
 * qualquer pode usar: quem responde isso é `direitoAoWhatsapp`
 * (`lib/plans/max.ts`), lendo `max_vigente()` e o estado da conexão daquela
 * empresa.
 *
 * A distinção é nova nesta fase e precisa ficar escrita. Nas anteriores as duas
 * perguntas tinham a mesma resposta — a ponte estava de pé para todos ou para
 * ninguém —, e por isso estas funções eram globais. Agora "o produto tem" e "a
 * empresa pode" divergem o tempo todo.
 */
export const FASE_DO_WHATSAPP: FaseDoWhatsapp = 'zapi'

/** Dá para conectar um número novo agora? */
export function podeConectarWhatsapp(): boolean {
  return FASE_DO_WHATSAPP !== 'migrando'
}

/**
 * Dá para ENVIAR mensagem agora?
 *
 * Hoje devolve o mesmo que `podeConectarWhatsapp`, e mesmo assim é função
 * separada: as duas perguntas são diferentes e podem divergir. Numa fase de
 * volta gradual, por exemplo, quem já tem número conectado envia enquanto
 * ninguém novo conecta — e aí a diferença passa a existir sem ninguém precisar
 * caçar os chamadores.
 *
 * Nasceu porque `lib/conversas/actions.ts` checava o PLANO antes da migração e
 * mandava fazer upgrade: quem pagasse por causa da frase receberia "Limite de
 * 0 mensagens por hora atingido", porque `escolherRemetente` devolve sempre
 * `emMigracao` enquanto a fase for esta.
 */
export function podeEnviarWhatsapp(): boolean {
  return FASE_DO_WHATSAPP !== 'migrando'
}

/**
 * O que a tela diz enquanto não dá para conectar.
 *
 * Diz o que está acontecendo, por que é melhor no fim, e o que a pessoa perde
 * enquanto isso. Não promete data: prazo de App Review não depende de nós, e
 * prometer semana que não se cumpre custa mais do que não prometer nada.
 */
export const AVISO_DE_MIGRACAO = {
  titulo: 'Migrando para o WhatsApp oficial',
  detalhe:
    'Estamos trocando a conexão pela API oficial da Meta, que não cai e não corre risco de bloqueio. ' +
    'Enquanto a aprovação não sai, não dá para conectar um número novo, e as mensagens não entram no funil.',
  /** Texto curto, para caber em `last_error` e em linha de card. */
  curto: 'WhatsApp em migração para a API oficial da Meta.',
} as const

/**
 * O selo que o card de WhatsApp mostra em Configurações.
 *
 * ## Por que "Em breve" e não "Recurso Pro"
 *
 * Durante a migração o WhatsApp não funciona para NINGUÉM — nem no Free, nem
 * no Pro. Dizer "é um recurso Pro" para quem está no Free implica que pagar
 * resolve, e não resolve: quem pagar hoje descobre depois que não funciona
 * para ele também.
 *
 * Prometer o que o produto não entrega é a classe de defeito que este projeto
 * já pagou duas vezes: os "contatos ilimitados" que a landing anunciava com o
 * Free em 300, e o CNPJ baixado exibido como prova de confiança. Nos dois casos
 * a promessa era conferível, e quem conferiu descobriu a mentira.
 */
export function seloDoWhatsapp(): { texto: string; tom: 'espera' | 'normal' } | null {
  if (FASE_DO_WHATSAPP === 'migrando') return { texto: 'Em breve', tom: 'espera' }
  // Na fase `zapi` o selo passa a nomear o PLANO, e não a espera. Continuar
  // dizendo "Em breve" com o recurso no ar seria a mesma mentira de antes, pelo
  // avesso: lá prometia o que não existia, aqui esconderia o que existe.
  if (FASE_DO_WHATSAPP === 'zapi') return { texto: 'Plano Max', tom: 'normal' }
  return null
}

/**
 * O que o card de Integrações diz agora que o WhatsApp saiu de lá.
 *
 * ## Por que ele SAIU de Integrações
 *
 * `integration_connections` é gateada em `pro_vigente()` por três policies da
 * 0037. O WhatsApp passou a ser do Max, que custa por empresa porque consome
 * uma instância paga. Guardar a conexão lá daria o recurso a quem paga Pro, e o
 * gate erraria para o lado do dinheiro em silêncio.
 *
 * O card fica, e vira uma placa: quem procura WhatsApp em Integrações precisa
 * achar o caminho, e não uma ausência.
 */
export const WHATSAPP_MORA_NO_MAX = {
  titulo: 'WhatsApp agora é do plano Max',
  detalhe:
    'A caixa de entrada do WhatsApp virou um plano próprio, com conexão por empresa. ' +
    'A conexão e o QR Code ficam em Configurações, WhatsApp.',
  destino: '/settings/whatsapp',
} as const

/**
 * O que o card diz para quem está no Free, durante a migração.
 *
 * Sem isto o Free veria "Integrações são um recurso Pro. Faça upgrade para
 * conectar" — uma cobrança por algo que o Pro também não entrega agora.
 */
export const AVISO_PARA_QUEM_NAO_TEM_PRO =
  'O WhatsApp vai fazer parte do plano Pro, e ainda não está disponível para ninguém: ' +
  'estamos migrando para a API oficial da Meta. Avisaremos quando abrir.'
