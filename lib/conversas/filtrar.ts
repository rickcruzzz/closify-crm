/**
 * Achar uma conversa numa lista de duzentas.
 *
 * ## Por que isto existe
 *
 * `getConversas` traz até 200. A ordenação por espera resolve "quem atender
 * agora" e não resolve a outra pergunta, que aparece o dia inteiro: *"o Jose da
 * marcenaria mandou mensagem ontem, onde está?"*. Sem busca, a resposta é rolar.
 *
 * ## Cliente e não servidor, de propósito
 *
 * As 200 já estão na memória da tela. Uma busca que vai ao servidor a cada
 * tecla pagaria uma viagem por letra para filtrar um vetor que está do lado, e
 * o resultado apareceria depois do que a pessoa digitou. Com o teto em 200, o
 * filtro em memória é instantâneo e não tem estado para dessincronizar.
 *
 * O dia em que o teto subir, esta decisão muda — e é por isso que ela está
 * escrita aqui, e não deduzida do código.
 */

/** O mínimo que o filtro precisa saber. Não é `ConversaNaLista` inteira de
 * propósito: o teste não deve precisar montar um negócio para buscar um nome. */
export type ConversaFiltravel = {
  nome: string
  telefone: string | null
  previa: string
  respondidaEm: string | null
  ultimoRecebidoEm: string | null
  donoId: string | null
}

export type Filtros = {
  busca: string
  /** Só as que ninguém respondeu ainda. */
  apenasEsperando: boolean
  /** Só as que EU assumi. */
  apenasMinhas: boolean
}

export const FILTROS_VAZIOS: Filtros = {
  busca: '',
  apenasEsperando: false,
  apenasMinhas: false,
}

/**
 * Tira acento e caixa, para "José" ser achado por "jose".
 *
 * `NFD` separa a letra do acento e o `replace` joga fora a marca. Sem isto, num
 * país onde metade dos nomes tem acento, quem digita no teclado do celular sem
 * acentuar não acha ninguém — e conclui que a conversa sumiu.
 */
function achatar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Só os dígitos, para telefone casar digitado de qualquer jeito. */
function digitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

/**
 * Aplica os filtros, preservando a ordem de entrada.
 *
 * A ordem NUNCA é recalculada aqui: quem ordena é `ordenarPorEspera`, e ela é a
 * regra de produto com teste próprio. Um filtro que também reordena seria uma
 * segunda definição de urgência, e duas definições divergem.
 */
export function filtrarConversas<T extends ConversaFiltravel>(
  conversas: T[],
  filtros: Filtros,
  usuarioId: string,
): T[] {
  const termo = achatar(filtros.busca.trim())
  const numero = digitos(filtros.busca)

  return conversas.filter((c) => {
    // `respondidaEm === null` é "esperando", e é a mesma definição que ordena a
    // tela (0056). Ler de outro jeito aqui faria o filtro discordar da ordem.
    //
    // E exige mensagem RECEBIDA: uma conversa em que só nós falamos tem
    // `respondida_em` nulo e não está esperando ninguém.
    if (filtros.apenasEsperando && (c.respondidaEm !== null || !c.ultimoRecebidoEm)) {
      return false
    }

    if (filtros.apenasMinhas && c.donoId !== usuarioId) return false

    if (!termo && !numero) return true

    if (termo && achatar(c.nome).includes(termo)) return true
    // A prévia entra na busca porque quem procura uma conversa costuma lembrar
    // do que foi dito, não do nome de quem disse.
    if (termo && achatar(c.previa).includes(termo)) return true

    // Telefone só casa quando a pessoa digitou número. Sem esta condição, uma
    // busca por "ana" viraria `digitos('ana') === ''`, e `''` está contido em
    // qualquer string — toda conversa passaria.
    if (numero && c.telefone && digitos(c.telefone).includes(numero)) return true

    return false
  })
}

/** Algum filtro está ligado? Decide se a tela mostra "limpar". */
export function temFiltroAtivo(filtros: Filtros): boolean {
  return (
    filtros.busca.trim().length > 0 || filtros.apenasEsperando || filtros.apenasMinhas
  )
}
