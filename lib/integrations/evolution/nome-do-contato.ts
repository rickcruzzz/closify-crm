/**
 * O nome que o WhatsApp manda, transformado em nome que se pode procurar.
 *
 * ## O problema, visto na primeira mensagem real (25/08)
 *
 * O contato entrou no funil como `𝖵𝖾𝗅𝗈 𝖥𝗎𝗇𝗂𝗅`. Não é erro de fonte: é o que o
 * `PushName` traz. O WhatsApp deixa a pessoa escolher qualquer texto, e é
 * comum usar os blocos matemáticos do Unicode (𝖠, 𝐀, 𝓐) porque parecem
 * "estilizados" no aplicativo.
 *
 * Isso custa três coisas dentro de um CRM:
 *
 * **Não é buscável.** Procurar "Velo" não acha `𝖵𝖾𝗅𝗈`, porque `𝖵` e `V` são
 * caracteres diferentes. O contato existe e some da busca — o pior tipo de
 * dado, o que está lá e não aparece.
 *
 * **Quebra em várias fontes**, virando quadradinho em PDF exportado, em
 * e-mail e em qualquer lugar fora do navegador.
 *
 * **Não ordena.** Uma lista de contatos joga os estilizados para fora da
 * ordem alfabética, onde ninguém procura.
 *
 * ## Por que normalizar em vez de recusar
 *
 * O nome é a única identificação humana que a mensagem traz. Trocar por
 * "WhatsApp 9404" perderia informação real. A normalização mantém o nome que
 * a pessoa escolheu e devolve a ele o alfabeto comum.
 */

/**
 * Converte os blocos estilizados do Unicode para a letra correspondente.
 *
 * `NFKD` já resolve a maioria (matemático, largura total, sobrescrito): é a
 * decomposição de COMPATIBILIDADE, feita exatamente para dizer que `𝖵` é uma
 * variante de `V`. O que ela não cobre são os cercados (Ⓐ) e alguns blocos
 * decorativos, tratados na varredura seguinte.
 */
function desestilizar(texto: string): string {
  let saida = texto.normalize('NFKD')

  // Remove as marcas de combinação que a decomposição produz — sem isso,
  // "José" viraria "Jose" com um acento solto flutuando depois do "e".
  // O acento LEGÍTIMO é reposto pela recomposição no fim.
  saida = saida.normalize('NFC')

  // Cercados: Ⓐ-Ⓩ, ⓐ-ⓩ, ⑴-⒵. O NFKD resolve parte, e o resto vira letra aqui.
  saida = saida.replace(/[Ⓐ-Ⓩ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x24b6 + 65),
  )
  saida = saida.replace(/[ⓐ-ⓩ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x24d0 + 97),
  )

  return saida
}

/**
 * Emoji e símbolos decorativos que não fazem parte de um nome.
 *
 * Não é frescura: `Maria 💅✨` numa lista ordenada, num PDF de relatório e
 * numa busca por "Maria" se comporta pior do que `Maria`. O emoji fica no
 * WhatsApp, onde ele significa algo.
 */
// Escrito com pares substitutos em vez de `\u{...}` e da flag `u`: o
// `tsconfig` deste projeto não declara `target`, então ele é ES5, onde a flag
// não existe. O primeiro ramo cobre os planos astrais, onde mora quase todo
// emoji; o segundo cobre os símbolos que ficam no plano básico.
const DECORATIVOS =
  /[\uD800-\uDBFF][\uDC00-\uDFFF]|[☀-➿︀-️‍⃣]/g

/** Quantos caracteres de nome guardar. Mais que isso é recado, não nome. */
const TAMANHO_MAXIMO = 80

/**
 * Devolve um nome utilizável, ou `null` quando não sobra nada de útil.
 *
 * `null` é resposta legítima: `PushName` pode vir vazio, só com emoji, ou ser
 * o próprio número. Quem chama decide o rótulo alternativo — e faz isso
 * melhor daqui, porque conhece o telefone.
 */
export function nomeDeContato(pushName: string | null | undefined): string | null {
  if (!pushName) return null

  let nome = desestilizar(pushName)
  nome = nome.replace(DECORATIVOS, '')

  // Espaços que a remoção deixou para trás, e os que já vinham no original.
  nome = nome.replace(/\s+/g, ' ').trim()

  if (nome.length > TAMANHO_MAXIMO) nome = `${nome.slice(0, TAMANHO_MAXIMO).trimEnd()}…`

  // Sobrou só pontuação, ou só dígitos? Então não é nome. Um "nome" que é o
  // próprio telefone duplicaria a informação que já está na coluna ao lado.
  //
  // A faixa é latina, não `\p{L}`: a flag `u` que `\p` exige não existe no
  // target deste projeto. Cobre o alfabeto do público-alvo, e o custo de errar
  // é um nome cirílico virar `null` e cair no rótulo com o telefone.
  if (!/[a-zA-ZÀ-ÖØ-öø-ÿ]/.test(nome)) return null

  return nome
}
