/**
 * Formatação de campos enquanto a pessoa digita.
 *
 * O valor de negócio e o telefone eram `<input>` cru: a pessoa digitava
 * "1500" e ficava "1500", sem saber se era mil e quinhentos ou quinze reais.
 * Formatar durante a digitação resolve isso sem exigir que ela acerte a
 * pontuação.
 *
 * As funções trabalham sempre sobre os DÍGITOS, nunca sobre o texto
 * formatado: reformatar texto já formatado acumula pontuação a cada tecla.
 */

/**
 * Centavos → "1.234,56". O último par de dígitos é sempre a casa decimal, que
 * é como funciona teclado de caixa: digitar 1, 5, 0, 0 mostra 15,00.
 */
export function formatarMoedaBRL(digitos: string): string {
  const limpo = digitos.replace(/\D/g, '')
  if (!limpo) return ''

  // Sem limite, um colar acidental de texto longo geraria número absurdo.
  const cortado = limpo.slice(0, 15)
  const centavos = Number(cortado)

  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** "1.234,56" → 1234.56, para enviar ao banco como número. */
export function moedaParaNumero(formatado: string): number {
  const limpo = formatado.replace(/\D/g, '')
  return limpo ? Number(limpo) / 100 : 0
}

/** Número do banco → "1.234,56", para preencher o campo ao editar. */
export function numeroParaMoeda(valor: number): string {
  if (!valor) return ''
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Telefone brasileiro: "(11) 91234-5678" para celular, "(11) 1234-5678" para
 * fixo. A diferença é o nono dígito, então o formato só se define quando a
 * pessoa passa de 10 dígitos, antes disso o fixo é o palpite correto.
 */
export function formatarTelefoneBR(entrada: string): string {
  const d = entrada.replace(/\D/g, '').slice(0, 11)
  if (!d) return ''

  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
