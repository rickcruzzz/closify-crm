/**
 * As iniciais de um nome, para o avatar.
 *
 * ## Por que virou função própria
 *
 * Estava copiada em três arquivos do Kanban (`deal-card.tsx`,
 * `deal-card-overlay.tsx`, `deal-detail-sheet.tsx`), e a tela de Conversas ia
 * ser a quarta. É a classe 7 do diagnóstico de 25/08: mesma regra escrita em
 * vários lugares, que divergem no primeiro dia em que uma mudar.
 *
 * As três cópias tinham o mesmo defeito, e é o motivo de existir teste aqui:
 * elas pegavam as duas PRIMEIRAS palavras. "Maria da Silva" virava "MD", e
 * "Auto Peças Bahia" virava "AP" — nenhum dos dois é a inicial que uma pessoa
 * escreveria.
 */

/**
 * Palavras que não carregam inicial.
 *
 * Nome brasileiro composto quase sempre tem uma delas no meio, e é justamente
 * o meio que as versões antigas pegavam.
 */
const LIGACOES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'la'])

export function iniciais(nome: string | null | undefined): string {
  if (!nome) return '?'

  const partes = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((parte) => !LIGACOES.has(parte.toLowerCase()))

  if (partes.length === 0) return '?'

  // Primeira e ÚLTIMA, não as duas primeiras: quem se chama "Maria Fernanda
  // Souza" é reconhecida por "MS", não por "MF".
  const primeira = partes[0]!
  const ultima = partes.length > 1 ? partes[partes.length - 1]! : ''

  const letras = (primeira[0] ?? '') + (ultima[0] ?? '')
  return letras.toUpperCase() || '?'
}
