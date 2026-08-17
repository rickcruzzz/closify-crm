import { somenteDigitos } from '@/lib/validations/empresa'

/**
 * Máscaras de digitação.
 *
 * Elas são da TELA, não do dado. O banco guarda dígito puro e recusa máscara
 *, `workspaces.cnpj` tem `check (cnpj ~ '^[0-9]{14}$')`. Quem desmonta é o
 * Zod, com `somenteDigitos`, antes de salvar.
 *
 * Todas cortam o excesso em vez de recusar: colar um CNPJ com texto em volta
 * deve aproveitar os catorze dígitos, não devolver campo vazio.
 */

/** `00.000.000/0000-00` */
export function formatarCNPJ(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 14)

  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`

  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** `00000-000` */
export function formatarCEP(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 8)
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`
}

/**
 * `(00) 0000-0000` ou `(00) 00000-0000`, pelo tamanho.
 *
 * O ponto de corte muda com o nono dígito: até dez dígitos é fixo e o hífen
 * cai depois do quarto; a partir do décimo primeiro é celular e o hífen desce
 * um. Sem isso, digitar um celular mostra `(11) 9888-87777` até o último
 * caractere e o número parece errado enquanto se digita.
 */
export function formatarTelefone(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11)

  if (d.length <= 2) return d.length === 0 ? '' : `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`

  const corte = d.length <= 10 ? 6 : 7
  return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`
}

export type Mascara = (valor: string) => string

/**
 * Onde o cursor deve ficar depois de a máscara reescrever o campo.
 *
 * Máscara ingênua devolve só o texto novo, e o navegador joga o cursor para o
 * fim, corrigir um dígito no meio de um CNPJ vira impossível, porque a cada
 * tecla o cursor foge.
 *
 * A conta é feita em DÍGITOS, não em caracteres: conta quantos dígitos existem
 * antes do cursor no texto que a pessoa acabou de digitar, e reencontra essa
 * mesma posição no texto formatado. Assim a pontuação inserida pela máscara
 * não desloca nada.
 */
export function cursorDepoisDaMascara(
  textoDigitado: string,
  posicaoDoCursor: number,
  textoFormatado: string,
): number {
  const digitosAntes = somenteDigitos(textoDigitado.slice(0, posicaoDoCursor)).length

  if (digitosAntes === 0) return 0

  let vistos = 0
  for (let i = 0; i < textoFormatado.length; i++) {
    if (/\d/.test(textoFormatado[i]!)) {
      vistos++
      if (vistos === digitosAntes) return i + 1
    }
  }

  return textoFormatado.length
}
