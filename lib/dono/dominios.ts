/**
 * Detecção de e-mail com domínio digitado errado.
 *
 * ## Por que isso é um alerta, e não um detalhe
 *
 * Caso real, achado em produção em 20/08/2026: a empresa "Agência Nova Era" tem
 * como única dona a conta `testei122@gmaa2il.com` — `gmaa2il` no lugar de
 * `gmail`. Essa pessoa **nunca vai receber e-mail nenhum**: nem a confirmação
 * de cadastro, nem recuperação de senha, nem cobrança. Ela está travada e não
 * há como avisá-la pelo canal que o produto usa.
 *
 * Nada no sistema percebia isso. O envio "funciona" (o Resend aceita), o
 * bounce acontece longe, e a pessoa simplesmente some — indistinguível de quem
 * desistiu. Com o alerta, dá para ligar no telefone que ela cadastrou.
 *
 * Sem `server-only`: função pura, sem I/O, testável direto no Vitest.
 */

/**
 * Domínios de e-mail comuns no Brasil, que são justamente os que a pessoa
 * digita rápido e erra. Lista curta de propósito: quanto mais domínios aqui,
 * maior a chance de um domínio corporativo legítimo parecer "quase" um deles e
 * gerar alarme falso.
 */
const DOMINIOS_COMUNS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com.br',
  'icloud.com',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'live.com',
]

/**
 * Distância de edição entre duas palavras (Levenshtein).
 *
 * Quantas letras precisam ser trocadas, inseridas ou removidas para uma virar
 * a outra. `gmaa2il.com` → `gmail.com` custa 2. É o que separa "erro de
 * digitação" de "domínio diferente".
 */
function distancia(a: string, b: string): number {
  // Uma linha só da matriz por vez: o algoritmo clássico guarda a matriz
  // inteira, e aqui só a linha anterior importa.
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      atual[j] = Math.min(
        anterior[j] + 1, // remoção
        atual[j - 1] + 1, // inserção
        anterior[j - 1] + custo, // substituição
      )
    }
    anterior = atual
  }

  return anterior[b.length]
}

/**
 * Devolve o domínio que a pessoa provavelmente quis digitar, ou `null` quando
 * o e-mail parece certo.
 *
 * O corte é distância 1 ou 2. Distância 3 já pega domínio legítimo de empresa
 * pequena por engano, e um alarme falso aqui é pior que um alerta perdido: ele
 * sugere que o dono avise um cliente de que o e-mail dele está errado quando
 * não está.
 */
export function dominioProvavelmenteErrado(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null

  const dominio = email.split('@')[1]?.toLowerCase()
  if (!dominio) return null

  // Domínio exato da lista está certo, não há o que sugerir.
  if (DOMINIOS_COMUNS.includes(dominio)) return null

  for (const comum of DOMINIOS_COMUNS) {
    const d = distancia(dominio, comum)
    if (d >= 1 && d <= 2) return comum
  }

  return null
}
