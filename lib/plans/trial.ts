/**
 * O estado do trial de 7 dias, decidido sem banco e sem React.
 *
 * Vive isolado porque a decisão "mostrar aviso ou não" é a parte que erra: um
 * banner que aparece cedo demais vira paisagem antes de virar venda, e um que
 * aparece tarde demais chega depois de a pessoa já ter parado de abrir o
 * produto. Isolado, dá para travar cada caso num teste.
 */

/** Quantos dias o trial dura. Espelha `dias_de_trial` da migration 0051. */
export const DIAS_DE_TRIAL = 7

/**
 * A partir de quantos dias restantes o aviso aparece.
 *
 * ## Por que 3, e não desde o primeiro dia
 *
 * Aviso permanente é aviso ignorado. Nos primeiros dias a pessoa está
 * *avaliando* — importando contatos, conectando WhatsApp, entendendo o
 * produto — e cobrar decisão nessa hora atrapalha exatamente a experiência que
 * precisa convencê-la.
 *
 * A partir de 3 dias ela já formou opinião, e o aviso deixa de ser interrupção
 * para virar informação útil: o prazo existe e está perto.
 */
export const AVISAR_A_PARTIR_DE = 3

export type EstadoDoTrial =
  /** Nunca teve trial (empresa criada antes da 0051) ou já é cliente pagando. */
  | { tipo: 'sem_trial' }
  /** Em trial, ainda cedo para incomodar. */
  | { tipo: 'em_trial'; diasRestantes: number; avisar: false }
  /** Em trial, na reta final. */
  | { tipo: 'em_trial'; diasRestantes: number; avisar: true }
  /** O trial acabou e a pessoa está no Free. */
  | { tipo: 'acabou'; diasDesdeQueAcabou: number }

/**
 * Quantos dias inteiros faltam até o fim do trial.
 *
 * Arredonda para CIMA de propósito: enquanto sobrar qualquer fração de dia, a
 * pessoa ainda tem o dia. Dizer "0 dias" para quem tem 6 horas de acesso seria
 * mentir contra o próprio produto e provocar a sensação de ter sido cortado
 * antes da hora — sensação que custa mais caro que o dia extra.
 */
export function diasRestantesDoTrial(trialAte: string | Date, agora: Date = new Date()): number {
  const fim = trialAte instanceof Date ? trialAte : new Date(trialAte)
  const ms = fim.getTime() - agora.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/**
 * Traduz `trial_ate` no que a interface precisa saber.
 *
 * `assinaturaAtiva` entra na conta porque quem assinou durante o trial não pode
 * ver contagem regressiva nenhuma: ela já pagou, o prazo deixou de existir para
 * ela, e insistir com "faltam 2 dias" depois do pagamento é o tipo de erro que
 * faz a pessoa duvidar se a cobrança passou.
 */
export function estadoDoTrial(
  trialAte: string | null | undefined,
  assinaturaAtiva: boolean,
  agora: Date = new Date(),
): EstadoDoTrial {
  if (assinaturaAtiva || !trialAte) return { tipo: 'sem_trial' }

  const dias = diasRestantesDoTrial(trialAte, agora)

  if (dias <= 0) {
    return { tipo: 'acabou', diasDesdeQueAcabou: Math.abs(dias) }
  }

  return dias <= AVISAR_A_PARTIR_DE
    ? { tipo: 'em_trial', diasRestantes: dias, avisar: true }
    : { tipo: 'em_trial', diasRestantes: dias, avisar: false }
}

/**
 * O texto do aviso.
 *
 * ## Por que fala do que PARA de funcionar, e não do que "expira"
 *
 * "Seu teste expira em 2 dias" é sobre o nosso processo. "Em 2 dias o WhatsApp
 * para de trazer as mensagens para cá" é sobre o dia da pessoa. A segunda
 * versão descreve uma perda concreta que ela já sentiu o valor de ter — e é a
 * perda, não o prazo, que faz decidir.
 */
export function textoDoAviso(estado: EstadoDoTrial): { titulo: string; detalhe: string } | null {
  if (estado.tipo === 'sem_trial') return null

  if (estado.tipo === 'acabou') {
    return {
      titulo: 'Seu teste do Pro terminou',
      detalhe:
        'Seus contatos e negócios continuam aqui, inteiros. O que parou foi o WhatsApp trazendo ' +
        'as mensagens e o cadastro de contatos acima de 50.',
    }
  }

  if (!estado.avisar) return null

  const { diasRestantes } = estado

  if (diasRestantes === 1) {
    return {
      titulo: 'Último dia do seu teste',
      detalhe:
        'Amanhã o WhatsApp para de trazer as mensagens dos seus clientes para cá, e o cadastro ' +
        'de contatos trava em 50. Nada é apagado.',
    }
  }

  return {
    titulo: `Faltam ${diasRestantes} dias do seu teste`,
    detalhe:
      'Depois disso o WhatsApp para de trazer as mensagens para cá e o cadastro de contatos ' +
      'trava em 50. O que você já cadastrou continua aqui.',
  }
}
