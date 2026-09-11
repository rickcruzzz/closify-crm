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
  /** WhatsApp Cloud API oficial, aprovada e ligada. */
  | 'oficial'

/**
 * A fase de hoje.
 *
 * Mudar esta linha é o que reativa o botão de conectar quando a Cloud API for
 * aprovada. Nada mais precisa ser tocado na interface.
 */
export const FASE_DO_WHATSAPP: FaseDoWhatsapp = 'migrando'

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
  if (FASE_DO_WHATSAPP !== 'migrando') return null
  return { texto: 'Em breve', tom: 'espera' }
}

/**
 * O que o card diz para quem está no Free, durante a migração.
 *
 * Sem isto o Free veria "Integrações são um recurso Pro. Faça upgrade para
 * conectar" — uma cobrança por algo que o Pro também não entrega agora.
 */
export const AVISO_PARA_QUEM_NAO_TEM_PRO =
  'O WhatsApp vai fazer parte do plano Pro, e ainda não está disponível para ninguém: ' +
  'estamos migrando para a API oficial da Meta. Avisaremos quando abrir.'
