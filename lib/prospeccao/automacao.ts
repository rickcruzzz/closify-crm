/**
 * A resposta veio de um ROBÔ, não de uma pessoa.
 *
 * ## O defeito que isto existe para impedir, medido em 12/09
 *
 * As primeiras 47 mensagens do disparo produziram **18 "respostas"** — 38%,
 * contra os 3,8-7,2% que o setor responde. Número bom demais é o próprio sinal
 * de erro, e era: nenhuma das 18 era pessoa.
 *
 *     "Ola! Sou o Colibri, assistente virtual da Detecta"
 *     "Ola me chamo Helena, sua assistente virtual"
 *     "Agradecemos sua mensagem. Nao estamos disponiveis no momento"
 *     "Estamos fora do horario. Seg-Sex: 9h-11h / 14h-17h"
 *     "Ja conectei voce a nossa equipe"
 *
 * Sem esta camada, o painel de inteligência mostraria **38% de taxa de
 * resposta** — plausível, alto, e inteiramente falso. E a decisão que ele
 * orientaria seria escalar para 200/dia sobre ruído.
 *
 * É a classe de erro mais caro deste projeto, e está escrita no
 * `estado-atual.md`: *"erro que produz número plausível é o mais caro que
 * existe"*. Em 29/08 uma classificação feita à mão produziu *"6 de 9 clientes
 * abandonaram"*, e o número foi repetido em quatro documentos antes de alguém
 * conferir.
 *
 * ## O TEMPO é a prova, não o texto
 *
 * Medido nas 27 mensagens recebidas:
 *
 *     em ate 60 segundos    25 de 27   (93%)
 *     em ate 10 segundos    15
 *     media                 15 segundos
 *     depois de 5 minutos    0         <- NENHUMA
 *
 * Dá para escrever um robô que não diz "assistente virtual". Não dá para fazer
 * uma pessoa ler uma mensagem fria, entender a proposta e responder em quinze
 * segundos — e muito menos 25 pessoas diferentes fazendo isso.
 *
 * Por isso o tempo é o sinal primário e o texto é o de reforço, nunca o
 * contrário.
 *
 * ## E a detecção guarda um ACHADO de mercado
 *
 * 38% das empresas dos cinco nichos têm automação de WhatsApp. Isso não é
 * ruído: `pontuarProspect` dá `+3` para *"já paga por software"*, e acabamos
 * de descobrir que mais de um terço da fila se qualifica nesse sinal sem que
 * ninguém soubesse. Empresa que paga por robô de atendimento é empresa que
 * compra software.
 *
 * Por isso a detecção **não descarta** a linha: ela marca.
 */

/**
 * Segundos abaixo dos quais a resposta não pode ser humana.
 *
 * ## Começou em 60s, e subiu para 300 na mesma hora
 *
 * Sessenta deixou passar UMA, e ela é o caso mais instrutivo de todos. A
 * Elevato Móveis respondeu em ~70s com isto:
 *
 *     "Você está buscando uma solução para organizar e acompanhar os retornos
 *      de orçamentos/projetos, ou quer falar de algum produto específico da
 *      Elevato?"
 *
 * É um agente de IA — ele LEU a mensagem e respondeu em cima dela. Nenhuma
 * frase da lista abaixo o pega, porque ele não fala como robô: ele fala como
 * vendedor. O que o entrega é o `"Olá. Como posso ajudar hoje?"` que veio no
 * mesmo minuto, e o tempo.
 *
 * **Cinco minutos, então.** Medido: das 27 mensagens recebidas, ZERO chegou
 * depois de 5 min. O corte não descarta nada que tenha sido observado como
 * humano.
 *
 * ## A direção do erro decide o número, e ela é assimétrica
 *
 *     corte alto demais   uma pessoa rapida vira "robo". A mensagem dela
 *                         CONTINUA na caixa, o dono JA foi avisado no
 *                         WhatsApp, e o disparo nao reenvia (o estado e o
 *                         arquivo local, nao esta coluna). Custo: o painel
 *                         conta uma resposta de menos
 *     corte baixo demais  38% de taxa de resposta falsa, e a decisao que ela
 *                         orienta e escalar para 200/dia sobre ruido
 *
 * Contar de menos é recuperável. Escalar sobre ruído não.
 */
export const SEGUNDOS_HUMANAMENTE_IMPOSSIVEL = 300

/**
 * Frases que só aparecem em resposta automática.
 *
 * Sinal de REFORÇO, nunca sozinho: uma pessoa pode escrever "agradecemos o
 * contato", e barrá-la por isso perderia justamente quem respondeu de verdade.
 * Só vale quando o tempo não decidiu.
 */
const FRASES = [
  /assistente virtual/,
  /\bbot\b/,
  /fora do (nosso )?hor[aá]rio/,
  /n[ãa]o estamos dispon[ií]ve/,
  /responderemos (assim que|o mais)/,
  /em breve (alguem|alguém|um atendente)/,
  /(escolha|selecione) (uma |a )?op[çc]/,
  /digite \d/,
  /nosso (atendimento|hor[aá]rio) (e|é) de/,
  /seg-?sex/,
  /ja conectei voce|já conectei você/,
  /aguarde (um momento|que)/,
  /mensagem autom[aá]tica/,
] as const

export type Veredito = {
  automatica: boolean
  /** Por que. Vai para o registro — sem isso o número não é auditável. */
  motivo: string | null
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Esta resposta é de robô?
 *
 * @param texto o que chegou
 * @param segundos quanto tempo depois do envio. `null` quando não se sabe —
 *   e aí só o texto decide, que é o caminho mais fraco de propósito.
 */
export function ehRespostaAutomatica(
  texto: string | null | undefined,
  segundos: number | null,
): Veredito {
  if (segundos !== null && segundos >= 0 && segundos < SEGUNDOS_HUMANAMENTE_IMPOSSIVEL) {
    return {
      automatica: true,
      motivo: `chegou em ${Math.round(segundos)}s — humano não lê e responde nesse tempo`,
    }
  }

  const limpo = normalizar(texto ?? '')
  if (!limpo) return { automatica: false, motivo: null }

  for (const frase of FRASES) {
    if (frase.test(limpo)) {
      return { automatica: true, motivo: 'texto de atendimento automático' }
    }
  }

  return { automatica: false, motivo: null }
}

/** Segundos entre o envio e a resposta, ou `null` quando falta uma das datas. */
export function segundosDepoisDoEnvio(
  enviadoEm: string | null | undefined,
  recebidoEm: string | null | undefined,
): number | null {
  if (!enviadoEm || !recebidoEm) return null
  const delta = (Date.parse(recebidoEm) - Date.parse(enviadoEm)) / 1000
  return Number.isFinite(delta) ? delta : null
}
