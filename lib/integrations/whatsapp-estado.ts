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
