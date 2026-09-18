/**
 * Quando uma mensagem que falhou merece outra tentativa.
 *
 * Puro de propósito: a decisão é aritmética sobre um contador e duas datas, e
 * é justamente o tipo de regra que, escrita dentro do laço que faz I/O, nunca
 * é exercitada até o dia em que erra em produção.
 */

/**
 * A espera antes de cada tentativa, em minutos.
 *
 * ## Por que uma tabela e não uma fórmula
 *
 * `2 ** tentativas` é elegante e dá 1, 2, 4, 8, 16 minutos: rápido demais no
 * começo (a Z-API fora do ar não volta em um minuto) e curto demais no fim.
 * A tabela diz o que se quer em cada degrau, e quem lê não precisa calcular:
 *
 *     0 -> 1     2 min     falha de rede, volta sozinha
 *     1 -> 2    10 min     instabilidade curta do provedor
 *     2 -> 3    30 min     incidente do provedor
 *     3 -> 4     2 h       incidente longo
 *     4 -> 5     6 h       ultima chance antes de desistir
 *
 * Somadas, as cinco cobrem ~9 horas. Além disso o problema deixou de ser
 * transitório, e insistir vira ruído: o número do cliente tem teto por hora, e
 * cada retentativa inútil ocupa uma vaga de mensagem que poderia sair.
 */
const ESPERA_EM_MINUTOS = [2, 10, 30, 120, 360] as const

/**
 * Depois disto, para de tentar.
 *
 * Cinco e o tamanho da tabela acima, e as duas coisas precisam andar juntas:
 * um teto maior que a tabela leria `undefined` como espera.
 */
export const MAXIMO_DE_TENTATIVAS = ESPERA_EM_MINUTOS.length

/**
 * Depois disto a mensagem nao sai mais, mesmo sem nunca ter sido tentada.
 *
 * ## O defeito que isto fecha, achado no dado real em 18/09
 *
 * A primeira versao so olhava tentativas. A fila de producao tinha uma
 * mensagem de **26/08** com `tentativas = 0`: ela nunca foi tentada porque a
 * empresa nunca teve conexao de volta, entao a escada de tentativas nunca
 * comecou a correr.
 *
 * No dia em que aquela empresa parear um numero, a fila entregaria um texto de
 * tres semanas atras. **Uma mensagem fora de hora e pior que mensagem
 * nenhuma**: o cliente ja resolveu, ja comprou de outro, ou nao lembra do que
 * se trata, e quem escreveu nao sabe que ela saiu.
 *
 * Vinte e quatro horas e o corte porque e o horizonte em que a conversa ainda
 * e a mesma. Passou disso, quem escreveu reescreve com o contexto de hoje.
 */
export const IDADE_MAXIMA_EM_HORAS = 24

export type MensagemDaFila = {
  id: string
  conversaId: string
  workspaceId: string
  texto: string
  telefone: string | null
  tentativas: number
  /** `null` significa que o provedor NUNCA aceitou. É o que autoriza reenviar. */
  externalId: string | null
  /** Quando a linha nasceu. A espera conta a partir daqui. */
  criadaEm: string
}

export type DecisaoDeReenvio =
  | { reenviar: true }
  | {
      reenviar: false
      motivo: 'ja_aceita' | 'sem_destino' | 'desistiu' | 'velha_demais' | 'esperando'
    }

/**
 * ## A primeira porta é a que evita mandar duas vezes
 *
 * `externalId` preenchido quer dizer que a Z-API devolveu `zaapId`: ela aceitou
 * a mensagem. Aceitar não é entregar — a lição do `sendButtons` de 12/09, que
 * respondeu 201 quatro vezes sem renderizar nada — mas aceitar é o bastante
 * para **nunca repetir**: o risco de mandar a mesma coisa duas vezes para o
 * cliente é pior que o de uma entrega incerta.
 *
 * Uma linha com `external_id` e `status = 'falhou'` ao mesmo tempo não deveria
 * existir hoje, porque `actions.ts` grava um ou outro. A porta está aqui
 * assim mesmo: ela é barata e o dia em que a combinação aparecer é o dia em
 * que ela salva o cliente de receber a mensagem em dobro.
 */
export function deveReenviar(
  m: Pick<MensagemDaFila, 'tentativas' | 'externalId' | 'telefone' | 'criadaEm'>,
  agora: Date = new Date(),
): DecisaoDeReenvio {
  if (m.externalId) return { reenviar: false, motivo: 'ja_aceita' }

  // Sem número não há para onde mandar, e tentar cinco vezes o nada só gasta
  // vaga na fila. A conversa sem telefone existe: a caixa recebe de LID e de
  // grupo, e nem todo remetente tem número aproveitável.
  if (!m.telefone) return { reenviar: false, motivo: 'sem_destino' }

  if (m.tentativas >= MAXIMO_DE_TENTATIVAS) return { reenviar: false, motivo: 'desistiu' }

  const nascidaEm = new Date(m.criadaEm).getTime()
  if (
    Number.isFinite(nascidaEm) &&
    agora.getTime() - nascidaEm > IDADE_MAXIMA_EM_HORAS * 60 * 60 * 1000
  ) {
    return { reenviar: false, motivo: 'velha_demais' }
  }

  const nascida = new Date(m.criadaEm).getTime()
  // Data ilegível conta como AGORA, o que empurra a tentativa para a rodada
  // seguinte em vez de liberar um reenvio imediato. Errar segurando é barato;
  // errar soltando manda mensagem fora de hora.
  const base = Number.isFinite(nascida) ? nascida : agora.getTime()

  // A espera é acumulada: a terceira tentativa só acontece depois de 2 + 10 +
  // 30 minutos da criação. Contar a partir da última tentativa exigiria gravar
  // a data dela, e data derivada gravada é o defeito que a 0091 registra.
  const esperaTotal = ESPERA_EM_MINUTOS.slice(0, m.tentativas + 1).reduce((a, b) => a + b, 0)
  const liberaEm = base + esperaTotal * 60_000

  return agora.getTime() >= liberaEm ? { reenviar: true } : { reenviar: false, motivo: 'esperando' }
}

/** Quanto falta, em minutos, para a próxima tentativa. Para log e para tela. */
export function minutosAteAProxima(
  m: Pick<MensagemDaFila, 'tentativas' | 'criadaEm'>,
  agora: Date = new Date(),
): number {
  const nascida = new Date(m.criadaEm).getTime()
  const base = Number.isFinite(nascida) ? nascida : agora.getTime()
  const esperaTotal = ESPERA_EM_MINUTOS.slice(0, m.tentativas + 1).reduce((a, b) => a + b, 0)
  return Math.max(0, Math.ceil((base + esperaTotal * 60_000 - agora.getTime()) / 60_000))
}

/**
 * A fila de uma rodada: no máximo UMA mensagem por conversa.
 *
 * ## A ordem importa mais que o volume
 *
 * Duas mensagens falhadas na mesma conversa foram escritas numa ordem, e o
 * cliente vai lê-las na ordem em que chegarem. Reenviar as duas de uma vez
 * permite que a segunda chegue antes da primeira — e num orçamento, "te mando
 * hoje" depois de "pode ser?" inverte o sentido da conversa.
 *
 * Uma por rodada resolve sem fila distribuída: a segunda espera a próxima
 * passagem do cron, quando a primeira já terá `external_id`.
 *
 * As mensagens chegam ordenadas por `created_at` do banco, e o primeiro de
 * cada conversa é o mais antigo.
 */
export function umaPorConversa(fila: MensagemDaFila[]): MensagemDaFila[] {
  const vistas = new Set<string>()
  const escolhidas: MensagemDaFila[] = []

  for (const m of fila) {
    if (vistas.has(m.conversaId)) continue
    vistas.add(m.conversaId)
    escolhidas.push(m)
  }

  return escolhidas
}
