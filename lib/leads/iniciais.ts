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

  const letras = primeiroSimbolo(primeira) + primeiroSimbolo(ultima)
  return letras.toUpperCase() || '?'
}

/**
 * O primeiro SIMBOLO, e nao as primeiras dezesseis bits.
 *
 * ## O defeito, visto na caixa de entrada em 18/09
 *
 * `parte[0]` indexa unidades UTF-16. Emoji e fonte estilizada moram fora do
 * plano basico e ocupam DUAS unidades, entao `[0]` devolve metade de um par
 * substituto: um caractere que, sozinho, nao existe.
 *
 *     nome       "Velo", em fonte estilizada (U+1D5B5 e seguintes)
 *     parte[0]   um high surrogate solto
 *     na tela    o losango de caractere invalido, duas vezes
 *
 * **E nao para no avatar.** Substituto solto nao sobrevive igual dos dois
 * lados: o HTML do servidor carrega um, o React do navegador produz outro, e a
 * pagina INTEIRA toma React #425 e #422. Era o que estava no console de
 * `/conversas`, e a conta era um avatar quebrado derrubando a hidratacao da
 * tela toda.
 *
 * Isto e a caixa do WhatsApp: nome com emoji nao e caso raro, e o padrao de
 * quem usa o aplicativo.
 *
 * `Array.from` percorre por CODE POINT, que e a unidade que a pessoa ve. O
 * espalhamento (`[...parte]`) faria o mesmo e o `tsc` deste projeto o recusa
 * com TS2802, porque o alvo compilado e anterior a ES2015.
 */
function primeiroSimbolo(parte: string): string {
  if (!parte) return ''
  return Array.from(parte)[0] ?? ''
}
