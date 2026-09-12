import { apenasDigitos } from '@/lib/leads/planilha'

/**
 * Quem pediu para sair, e como reconhecer o pedido.
 *
 * ## Puro de propósito
 *
 * Sem `server-only` e sem I/O, o mesmo desenho de `atribuicao.ts` e
 * `google-ads.ts`: `server-only` impede o vitest de importar o módulo, e a
 * decisão "isto é um pedido de saída?" é exatamente o tipo de regra que erra
 * em silêncio e por isso precisa de teste. Quem toca o banco é
 * `opt-out-queries.ts`.
 *
 * ## A direção do erro é decisão, e é a mesma do `/nao-quero` por GET
 *
 * `app/(legal)/nao-quero/page.tsx` já registra o raciocínio: quando um dos
 * erros é recuperável e o outro não, o desenho escolhe o recuperável.
 *
 *     falso positivo   descadastra quem nao pediu — perde UM prospect
 *                      entre 837, e ele volta a aparecer se for tirado da lista
 *     falso negativo   manda de novo para quem pediu para sair — e segunda
 *                      abordagem depois de um "nao" e o primeiro item da lista
 *                      do que derruba um numero em limites-e-bloqueios.md
 *
 * Por isso a régua pende para descadastrar. **O que ela não faz é pender ao
 * ponto de confundir objeção com saída**: "já uso outro", "quanto custa" e
 * "agora não dá" são respostas valiosas, e tratá-las como opt-out apagaria
 * justamente a conversa que interessa.
 */

/** O prefixo é o canal, e ele mora na chave para haver UMA coluna única. */
const PREFIXO = {
  email: 'email',
  telefone: 'fone',
  dominio: 'dominio',
} as const

/**
 * Os últimos 8 dígitos de um telefone, ou `null`.
 *
 * A MESMA convenção de `encontrar_lead_por_telefone` (0047) e do índice
 * `leads_telefone_ultimos8_idx`, pelo motivo escrito lá: o WhatsApp entrega o
 * remetente com DDI (`5511999998888`) e o CSV do universo guardou o número em
 * qualquer formato. Os 8 finais são o miolo em qualquer formatação brasileira.
 *
 * Duas regras de telefone no mesmo projeto divergiriam, e a que divergisse em
 * silêncio deixaria passar quem pediu para sair.
 */
export function ultimos8(telefone: string | null | undefined): string | null {
  const digitos = apenasDigitos(telefone ?? '')
  // Menos de 8 dígitos é ramal ou número truncado. Completar com zero à
  // esquerda criaria uma chave que casa com números de verdade.
  return digitos.length >= 8 ? digitos.slice(-8) : null
}

export function chaveDeEmail(emailHash: string): string {
  return `${PREFIXO.email}:${emailHash}`
}

/** `null` quando o número não tem 8 dígitos aproveitáveis — não há o que barrar. */
export function chaveDeTelefone(telefone: string | null | undefined): string | null {
  const oito = ultimos8(telefone)
  return oito ? `${PREFIXO.telefone}:${oito}` : null
}

export function chaveDeDominio(dominio: string): string {
  return `${PREFIXO.dominio}:${dominio.trim().toLowerCase()}`
}

/**
 * Minúsculo, sem acento e com espaço colapsado.
 *
 * Sem acento porque os padrões abaixo ficam em ASCII: `não` e `nao` são a
 * mesma intenção, e metade das respostas de WhatsApp vem sem acento. Escrever
 * cada padrão duas vezes seria a segunda cópia que esquece um caso.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pedidos de saída reconhecíveis em QUALQUER posição da mensagem.
 *
 * Cada um nomeia o CONTATO, não só a recusa — e é isso que separa o pedido de
 * saída da resposta interessada. O caso que obrigou essa precisão:
 *
 *     "nao quero perder orcamento"   <- interesse, e contem "nao quero"
 *     "nao quero receber"            <- saida
 *
 * Um padrão solto de `nao quero` descadastraria o primeiro. Aqui `nao quero`
 * só vale seguido do que ele recusa.
 */
const PEDIDOS = [
  // Descadastrar, em qualquer conjugação.
  /\bdescadastr\w*/,
  /\bnao perturb\w*/,
  // "pare de mandar", "para de me mandar", "parem de enviar"
  /\bpar(e|a|em|ar) de (me )?(mandar|enviar|encher|perturbar|ligar)/,
  // "não me mande mais", "não me procura", "nao me manda mensagem"
  /\bnao me (mande|manda|mandem|envie|envia|enviem|procure|procura|perturbe|liga|ligue)/,
  // "não quero receber", "nao queremos mais contato", "não quero mais nada"
  /\bnao (quero|queremos|desejo|desejamos) (mais )?(receber|contato|mensagem|mensagens|nada|isso|saber)/,
  // "não tenho interesse", "sem interesse", "não temos interesse nenhum"
  /\bnao (tenho|temos) interesse/,
  /\bsem interesse\b/,
  /\bnao (me )?interessa\b/,
  // "tira meu número", "remove meu contato", "me tire dessa lista"
  /\b(tira|tire|tirar|remove|remova|remover|apaga|apague|apagar|exclui|exclua|excluir)\b[^.!?]{0,20}\b(meu|minha|o meu|esse|este|dessa|desta|da)\b[^.!?]{0,20}\b(numero|telefone|contato|nome|lista|cadastro)/,
  // "me tira da lista", "me tire dessa lista"
  /\bme (tira|tire|remove|remova|exclui|exclua)\b/,
  // "sair da lista", "quero sair da lista"
  /\bsair (da|dessa|desta|de sua|da sua)\b[^.!?]{0,12}\blista/,
] as const

/**
 * Mensagens CURTAS que são o pedido inteiro.
 *
 * Aqui a comparação é com o texto todo, não com um trecho, e é o que torna
 * seguro aceitar palavras que dentro de uma frase seriam ambíguas. `pare`
 * sozinho é um pedido; `pare` dentro de "pare pra pensar" não é, e a
 * comparação por igualdade recusa o segundo sem precisar de mais regra.
 *
 * **`nao` sozinho ficou de fora, de propósito.** A abordagem TERMINA numa
 * pergunta ("quem lembra de dar o retorno?"), então um "não" solto responde à
 * pergunta — e quer dizer *"ninguém lembra"*, que é interesse. Descadastrar
 * ali apagaria o prospect mais quente da fila.
 */
const RESPOSTAS_CURTAS = new Set([
  'sair',
  'pare',
  'para',
  'parar',
  'stop',
  'remover',
  'remova',
  'cancelar',
  'cancela',
  'descadastrar',
  'nao quero',
  'nao quero mais',
  'nao tenho interesse',
  'sem interesse',
  'nao me interessa',
  'nao insista',
  'nao perturbe',
])

/**
 * A pessoa pediu para não ser procurada de novo?
 *
 * Usado pelo webhook da Evolution na resposta recebida. Quando devolve `true`,
 * o pedido é gravado e o prospect sai da fila — e **nada é respondido**.
 * Tentar convencer quem pediu para sair é o caminho mais curto para "Bloquear
 * e denunciar".
 */
export function pediuParaSair(texto: string | null | undefined): boolean {
  if (!texto) return false
  const limpo = normalizar(texto)
  if (!limpo) return false

  // Pontuação de fim não muda a intenção: "pare!" é "pare".
  const semPontuacaoFinal = limpo.replace(/[.!?…]+$/, '').trim()
  if (RESPOSTAS_CURTAS.has(semPontuacaoFinal)) return true

  return PEDIDOS.some((padrao) => padrao.test(limpo))
}
