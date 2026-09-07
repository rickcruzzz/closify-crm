/**
 * Quebra um texto em pedaços de texto e de link, para a timeline renderizar.
 *
 * ## Por que existe
 *
 * A prospecção grava na timeline do contato a primeira mensagem pronta e um
 * link `wa.me` com o texto já codificado — é o que transforma "lista de 253
 * empresas" em "abrir e enviar". Só que `activity-timeline.tsx` renderiza a
 * descrição como texto puro num `<p>`, então o link aparecia como uma parede
 * de caracteres que ninguém copia à mão.
 *
 * ## Devolve PEDAÇOS, não HTML
 *
 * A descrição da atividade é escrita por gente: qualquer membro do workspace
 * pode digitar o que quiser ali. Devolver HTML para `dangerouslySetInnerHTML`
 * transformaria isso num vetor de XSS clássico.
 *
 * Aqui a função devolve uma lista de pedaços, e quem renderiza monta elementos
 * React — que escapam o texto sozinhos. O link vira `<a>` com o `href` que a
 * própria função validou.
 *
 * ## Só `https://`
 *
 * `http://` fica de fora de propósito, e `javascript:` mais ainda: o segundo é
 * execução de código disfarçada de link, e o primeiro não tem uso legítimo numa
 * nota de CRM em 2026. É a mesma regra do `check` de `href` em `notificacoes`
 * (0066), que recusa qualquer coisa que não comece com `/`.
 */

export type Pedaco = { tipo: 'texto'; valor: string } | { tipo: 'link'; valor: string }

/**
 * Casa uma URL https até o primeiro espaço. Pontuação final é devolvida ao
 * texto pelo ajuste abaixo — sem isso, "veja https://x.com." levaria o ponto
 * para dentro do endereço e o link quebraria.
 */
const URL_HTTPS = /https:\/\/[^\s<>"]+/g

export function linkificar(texto: string): Pedaco[] {
  const pedacos: Pedaco[] = []
  let ultimo = 0

  // `matchAll` devolve iterador, e o `target` deste projeto não itera isso
  // direto — a mesma restrição que já obrigou `Array.from` em `aprendizado.ts`.
  for (const achado of Array.from(texto.matchAll(URL_HTTPS))) {
    const inicio = achado.index ?? 0
    let url = achado[0]

    // Pontuação colada no fim é do texto, não do endereço.
    const cauda = url.match(/[.,;:!?)\]}]+$/)
    if (cauda) url = url.slice(0, -cauda[0].length)

    if (inicio > ultimo) pedacos.push({ tipo: 'texto', valor: texto.slice(ultimo, inicio) })
    pedacos.push({ tipo: 'link', valor: url })
    ultimo = inicio + url.length
  }

  if (ultimo < texto.length) pedacos.push({ tipo: 'texto', valor: texto.slice(ultimo) })
  return pedacos
}

/**
 * O rótulo que aparece no lugar do endereço.
 *
 * O link do `wa.me` da prospecção tem a mensagem inteira codificada na query e
 * passa de 500 caracteres. Mostrá-lo cru empurraria o resto da nota para fora
 * da tela — e o que a pessoa precisa saber é para onde ele leva, não o que
 * está escrito nele.
 */
export function rotuloDoLink(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'wa.me') return 'Abrir no WhatsApp com a mensagem pronta'
    const caminho = u.pathname === '/' ? '' : u.pathname
    const inteiro = u.hostname.replace(/^www\./, '') + caminho
    return inteiro.length > 48 ? inteiro.slice(0, 47) + '…' : inteiro
  } catch {
    return url
  }
}
