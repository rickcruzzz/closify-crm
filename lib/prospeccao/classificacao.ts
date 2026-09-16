/**
 * As categorias fechadas da Fase 2, e as regras que a IA NÃO decide sozinha.
 *
 * ## Por que fechadas
 *
 * Um modelo de linguagem solto inventa vinte nomes para a mesma objeção, e
 * vinte nomes não somam. O painel precisa dizer *"preço aparece em 12 de 40
 * respostas"*, e isso só existe se `PRECO` for sempre a mesma palavra. As
 * listas abaixo são a fonte, o prompt as recebe, e o `check` da 0086 é a última
 * porta — categoria fora da lista é recusada pelo banco em vez de entrar e
 * contaminar a estatística com um caso único.
 *
 * ## Por que este arquivo é PURO
 *
 * Sem `server-only` e sem I/O, o mesmo desenho de `atribuicao.ts` e
 * `opt-out.ts`. A parte que decide — o teto de temperatura, o mapa para
 * estágio, quando chamar humano — erra em silêncio e por isso precisa de teste.
 * Quem fala com a OpenAI é `classificar.ts`.
 */

/**
 * A versão do prompt, gravada em cada linha.
 *
 * Sem ela, uma queda de qualidade depois de reescrever a instrução fica
 * indistinguível de *"os prospects pioraram"* — e a segunda conclusão manda
 * mexer no lugar errado.
 */
export const VERSAO_DO_PROMPT = '2026-09-12.2'

export const INTENCOES = [
  'INTERESSE_ALTO',
  'INTERESSE_MODERADO',
  'PEDIU_PRECO',
  'PEDIU_DETALHES',
  'QUER_DEMO',
  'QUER_CONHECER',
  'JA_USA_CRM',
  'JA_TEM_PROCESSO',
  'SEM_INTERESSE',
  'TALVEZ_DEPOIS',
  'NAO_E_RESPONSAVEL',
  'PEDIU_OUTRO_CONTATO',
  'OBJECAO_PRECO',
  'OBJECAO_TEMPO',
  'OBJECAO_NECESSIDADE',
  'OBJECAO_CONFIANCA',
  'OBJECAO_JA_TENHO_SOLUCAO',
  'OPT_OUT',
  'SPAM',
  'INCONCLUSIVO',
] as const
export type Intencao = (typeof INTENCOES)[number]

export const OBJECOES = [
  'PRECO',
  'TEMPO',
  'PRIORIDADE',
  'JA_USA_CRM',
  'JA_USA_PLANILHA',
  'NAO_VE_NECESSIDADE',
  'DESCONFIANCA',
  'NAO_E_RESPONSAVEL',
  'SEM_MOMENTO',
  'QUER_COMPARAR',
  'CONCORRENTE',
  'OUTRA',
] as const
export type Objecao = (typeof OBJECOES)[number]

/**
 * As cinco temperaturas, do mais frio ao mais quente. A ORDEM é significativa:
 * `tetoDaIntencao` compara posições nesta lista.
 */
export const TEMPERATURAS = ['frio', 'morno', 'quente', 'muito_quente', 'fechamento'] as const
export type Temperatura = (typeof TEMPERATURAS)[number]

/**
 * Os estágios que a Fase 2 de fato escreve.
 *
 * `CHECKOUT_SENT`, `PAYMENT_PENDING` e `CONVERTED` ficam de fora porque nada
 * os escreve: ninguém envia checkout pela conversa ainda. Declará-los faria o
 * painel mostrar um degrau que sempre vale zero — e a leitura seria "ninguém
 * chega lá", quando a verdade é que não há como chegar.
 */
export const ESTAGIOS = [
  'CONTACTED',
  'REPLIED',
  'QUALIFYING',
  'INTERESTED',
  'OBJECTION',
  'CONSIDERING',
  'LOST',
  'OPTED_OUT',
  'HUMAN_HANDOFF',
] as const
export type Estagio = (typeof ESTAGIOS)[number]

export const ehIntencao = (v: unknown): v is Intencao =>
  typeof v === 'string' && (INTENCOES as readonly string[]).includes(v)
export const ehObjecao = (v: unknown): v is Objecao =>
  typeof v === 'string' && (OBJECOES as readonly string[]).includes(v)
export const ehTemperatura = (v: unknown): v is Temperatura =>
  typeof v === 'string' && (TEMPERATURAS as readonly string[]).includes(v)

/**
 * O teto de temperatura por intenção.
 *
 * ## A regra que este mapa existe para impedir
 *
 * *"Não deixar a IA transformar qualquer 'quanto custa?' automaticamente em
 * fechamento."* Perguntar preço é curiosidade com frequência, e tratar isso
 * como fechamento faz duas coisas ruins ao mesmo tempo: enche o painel de
 * oportunidades que não existem, e — pior — orienta o dono a ligar cobrando
 * decisão de quem só perguntou.
 *
 * O modelo PROPÕE a temperatura; este mapa é o teto. Ele nunca sobe nada: se o
 * modelo disser `frio` para `INTERESSE_ALTO`, fica frio. Baixar é recuperável,
 * subir cria trabalho em cima de nada.
 */
const TETO: Record<Intencao, Temperatura> = {
  INTERESSE_ALTO: 'fechamento',
  QUER_DEMO: 'muito_quente',
  PEDIU_PRECO: 'quente',
  PEDIU_DETALHES: 'quente',
  INTERESSE_MODERADO: 'morno',
  QUER_CONHECER: 'morno',
  JA_USA_CRM: 'morno',
  JA_TEM_PROCESSO: 'morno',
  OBJECAO_PRECO: 'morno',
  OBJECAO_TEMPO: 'morno',
  OBJECAO_NECESSIDADE: 'morno',
  OBJECAO_CONFIANCA: 'morno',
  OBJECAO_JA_TENHO_SOLUCAO: 'morno',
  PEDIU_OUTRO_CONTATO: 'morno',
  TALVEZ_DEPOIS: 'frio',
  NAO_E_RESPONSAVEL: 'frio',
  SEM_INTERESSE: 'frio',
  OPT_OUT: 'frio',
  SPAM: 'frio',
  INCONCLUSIVO: 'frio',
}

/** O piso de confiança para `fechamento`. Abaixo dele, o máximo é `muito_quente`. */
const CONFIANCA_PARA_FECHAMENTO = 0.9

/**
 * A temperatura final: a proposta do modelo, limitada pelo teto da intenção.
 *
 * `fechamento` tem uma trava a mais, e ela é o que impede o degrau mais alto do
 * painel de encher com chute: além de exigir `INTERESSE_ALTO`, exige confiança
 * de pelo menos 0,9. É o único lugar onde a confiança muda o resultado em vez
 * de só ser registrada.
 */
export function temperaturaFinal(
  intencao: Intencao,
  proposta: Temperatura,
  confianca: number | null,
): Temperatura {
  const teto = TETO[intencao]
  const iProposta = TEMPERATURAS.indexOf(proposta)
  const iTeto = TEMPERATURAS.indexOf(teto)
  let final: Temperatura = iProposta > iTeto ? teto : proposta

  if (final === 'fechamento' && (confianca ?? 0) < CONFIANCA_PARA_FECHAMENTO) {
    final = 'muito_quente'
  }
  return final
}

/**
 * O estágio que a intenção implica.
 *
 * Mapa e não julgamento do modelo: o estágio é o que o painel usa para desenhar
 * o funil, e deixar o modelo escolher faria a mesma resposta cair em degraus
 * diferentes conforme o humor da amostragem.
 */
export function estagioDaIntencao(intencao: Intencao): Estagio {
  switch (intencao) {
    case 'OPT_OUT':
      return 'OPTED_OUT'
    case 'SEM_INTERESSE':
      return 'LOST'
    case 'INTERESSE_ALTO':
    case 'QUER_DEMO':
      return 'INTERESTED'
    case 'PEDIU_PRECO':
    case 'PEDIU_DETALHES':
    case 'QUER_CONHECER':
    case 'INTERESSE_MODERADO':
      return 'QUALIFYING'
    case 'OBJECAO_PRECO':
    case 'OBJECAO_TEMPO':
    case 'OBJECAO_NECESSIDADE':
    case 'OBJECAO_CONFIANCA':
    case 'OBJECAO_JA_TENHO_SOLUCAO':
    case 'JA_USA_CRM':
    case 'JA_TEM_PROCESSO':
      return 'OBJECTION'
    case 'TALVEZ_DEPOIS':
      return 'CONSIDERING'
    case 'NAO_E_RESPONSAVEL':
    case 'PEDIU_OUTRO_CONTATO':
      return 'HUMAN_HANDOFF'
    case 'SPAM':
    case 'INCONCLUSIVO':
      return 'REPLIED'
  }
}

/**
 * A ordem em que o prospect avança. TODO estágio precisa estar aqui.
 *
 * ## O defeito que esta lista existe para não repetir, medido em 12/09
 *
 * A primeira versão ordenava sete estágios e deixava `OPTED_OUT` e `LOST` de
 * fora, confiando numa exceção à parte para eles. `indexOf` devolve **-1** para
 * quem não está na lista — então qualquer estágio comum ficava "maior" que
 * `OPTED_OUT`, e a comparação `novo > atual` era verdadeira.
 *
 * Na prática: a pessoa respondia *"não quero receber mais"*, o estágio virava
 * `OPTED_OUT`, e a **mensagem seguinte** — qualquer uma — o arrastava de volta
 * para `REPLIED`. Silenciosamente, porque -1 não parece erro.
 *
 * Pego pela prova de ponta a ponta, não por leitura: as cinco respostas foram
 * processadas em ordem, e o estágio final saiu `REPLIED` quando tinha que ser
 * `OPTED_OUT`.
 */
const ORDEM_DO_ESTAGIO: Estagio[] = [
  'CONTACTED',
  'REPLIED',
  'LOST',
  'QUALIFYING',
  'OBJECTION',
  'CONSIDERING',
  'INTERESTED',
  'HUMAN_HANDOFF',
  'OPTED_OUT',
]

/**
 * Para onde o prospect vai, dado onde ele está e o que acabou de dizer.
 *
 * Três regras, e a primeira é a que importa:
 *
 *     OPTED_OUT e TERMINAL   quem disse "nao quero" nao volta, aconteca o que
 *                            acontecer depois. E promessa escrita na mensagem,
 *                            nao preferencia de produto
 *     LOST manda sempre      "sem interesse" e fato novo mesmo vindo de quem
 *                            estava interessado — mas NAO e terminal: um
 *                            "na verdade, quanto custa?" depois faz avancar
 *     o resto so AVANCA      quem chegou a INTERESTED e manda "ok" (que
 *                            classifica como INCONCLUSIVO) nao pode voltar
 *                            para REPLIED: o funil andaria para tras sozinho e
 *                            a leitura seria "a pessoa esfriou"
 */
export function proximoEstagio(atual: string, novo: Estagio): Estagio | string {
  if (atual === 'OPTED_OUT') return atual
  if (novo === 'OPTED_OUT' || novo === 'LOST') return novo

  const iAtual = ORDEM_DO_ESTAGIO.indexOf(atual as Estagio)
  const iNovo = ORDEM_DO_ESTAGIO.indexOf(novo)

  // Estágio desconhecido no `atual` (dado velho, migration futura) não pode
  // travar o avanço: sem referência, o que chegou agora é a melhor informação.
  if (iAtual === -1) return novo
  return iNovo > iAtual ? novo : atual
}

/** Piso de confiança abaixo do qual a IA não decide sozinha. */
const CONFIANCA_MINIMA = 0.6

/**
 * Sinais no texto que passam a conversa para um humano, aconteça o que
 * acontecer com a classificação.
 *
 * Nenhum deles é sobre a IA acertar ou errar a categoria: são assuntos em que
 * uma resposta automática custa mais que o silêncio. Jurídico e ameaça de
 * reclamação viram registro público; irritação respondida por robô vira print
 * no Twitter; desconto fora de política vira promessa que a empresa terá de
 * honrar.
 */
const PARA_HUMANO = [
  /\badvogad/,
  /\bjur[ií]dic/,
  /\bprocon\b/,
  /\bjusti[çc]a\b/,
  /\bprocesso judicial/,
  /\bvou (te )?denunciar/,
  /\breclame aqui\b/,
  /\babsurdo\b/,
  /\bgolpe\b/,
  /\bpalha[çc]ada\b/,
  /\bdesconto especial/,
  /\bme lig(a|ue)\b/,
  /\bpode (me )?ligar\b/,
  /\bliga pra mim\b/,
] as const

export type PedidoDeHumano = { precisa: boolean; motivo?: string }

/**
 * A IA deve se calar e chamar alguém?
 *
 * Três portas, em ordem de quanto custa errar:
 *
 *     assunto sensivel   jamais automatizado, seja qual for a confianca
 *     INCONCLUSIVO       o modelo disse que nao entendeu. Insistir seria
 *                        transformar "nao sei" em decisao
 *     confianca baixa    abaixo de 0,6 a categoria e chute, e chute entra na
 *                        estatistica com o mesmo peso de uma leitura certa
 *
 * **`OPT_OUT` nunca chama humano**, e é a exceção que importa: ele já tem
 * tratamento automático — registra e cala. Mandar para a fila humana faria
 * alguém abrir uma conversa com quem acabou de pedir para não ser procurado.
 */
export function precisaDeHumano(
  intencao: Intencao,
  texto: string,
  confianca: number | null,
): PedidoDeHumano {
  if (intencao === 'OPT_OUT') return { precisa: false }

  const limpo = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  for (const padrao of PARA_HUMANO) {
    if (padrao.test(limpo)) return { precisa: true, motivo: 'assunto que pede uma pessoa' }
  }

  if (intencao === 'INCONCLUSIVO') {
    return { precisa: true, motivo: 'não deu para entender a resposta' }
  }
  if ((confianca ?? 0) < CONFIANCA_MINIMA) {
    return { precisa: true, motivo: `confiança baixa (${(confianca ?? 0).toFixed(2)})` }
  }
  return { precisa: false }
}

/**
 * O objetivo da próxima interação, e só depois a estratégia.
 *
 * O pedido foi explícito: a IA não pode ir de *ler mensagem* direto para
 * *escrever resposta*. Ela decide primeiro o que aquela interação precisa
 * conseguir — e o objetivo é o que torna a resposta avaliável depois, porque dá
 * para perguntar se ele foi alcançado.
 *
 * Aqui é derivado da intenção, de propósito: na Fase 2 nada é enviado, então
 * isto é a RECOMENDAÇÃO que aparece na tela para o dono decidir. Deixar o
 * modelo inventar o objetivo criaria uma terceira categoria solta, que é
 * exatamente o que as listas fechadas existem para evitar.
 */
export function objetivoDa(intencao: Intencao): string {
  switch (intencao) {
    case 'INTERESSE_ALTO':
      return 'levar ao cadastro, hoje'
    case 'QUER_DEMO':
      return 'mostrar a tela, ou mandar o print de /hoje'
    case 'PEDIU_PRECO':
      return 'responder o preço e criar o próximo passo'
    case 'PEDIU_DETALHES':
    case 'QUER_CONHECER':
      return 'explicar o orçamento com prazo em uma frase'
    case 'INTERESSE_MODERADO':
      return 'descobrir como ele controla os orçamentos hoje'
    case 'JA_USA_CRM':
    case 'JA_TEM_PROCESSO':
    case 'OBJECAO_JA_TENHO_SOLUCAO':
      return 'perguntar se o que ele usa AVISA antes de o orçamento vencer'
    case 'OBJECAO_PRECO':
      return 'comparar com o preço por usuário do concorrente'
    case 'OBJECAO_TEMPO':
      return 'mostrar que a importação leva dois minutos'
    case 'OBJECAO_NECESSIDADE':
      return 'perguntar quantos orçamentos ficaram sem resposta no mês'
    case 'OBJECAO_CONFIANCA':
      return 'mostrar CNPJ, endereço e o plano gratuito sem cartão'
    case 'TALVEZ_DEPOIS':
      return 'combinar uma data, e registrar a tarefa'
    case 'NAO_E_RESPONSAVEL':
    case 'PEDIU_OUTRO_CONTATO':
      return 'pedir o contato de quem decide'
    case 'SEM_INTERESSE':
      return 'agradecer e encerrar'
    case 'OPT_OUT':
      return 'não responder, já registrado'
    case 'SPAM':
      return 'ignorar'
    case 'INCONCLUSIVO':
      return 'perguntar de volta, em uma linha'
  }
}
