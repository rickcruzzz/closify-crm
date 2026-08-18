export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function formatCompactBRL(value: number): string {
  const compact = new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
  return `R$ ${compact}`
}

/** A partir de onde o valor do negócio passa a ser abreviado no card. */
const LIMIAR_DE_ABREVIACAO = 1_000_000

/**
 * O valor como ele aparece no card do Kanban e no cabeçalho da etapa.
 *
 * Abaixo de um milhão devolve o valor cheio, de propósito: o ticket típico do
 * público do Velo Funil (agências, clínicas, consultorias) está na casa dos
 * milhares, e "R$ 3,5 mil" no lugar de "R$ 3.500,00" tiraria precisão de quem
 * usa o produto todos os dias. `formatCompactBRL`, que já existia, abrevia
 * desde o primeiro milhar e por isso serve ao Dashboard, não ao card.
 *
 * Acima do limiar abrevia, porque aí o problema se inverte: medido em
 * produção, existe negócio de `R$ 4.232.342.343,24`, dezenove caracteres, que
 * vira a coisa mais pesada do card e do cabeçalho da coluna. Quem lê um board
 * quer comparar ordens de grandeza, não conferir centavo de bilhão.
 *
 * Duas casas decimais, e não uma: com uma, `4.232.342.343` e `4.290.000.000`
 * viram os dois "R$ 4,2 bi" e o board deixa de distinguir negócios que diferem
 * em cinquenta milhões.
 */
export function formatarValorDeNegocio(value: number): string {
  if (Math.abs(value) < LIMIAR_DE_ABREVIACAO) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const compacto = new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)

  return `R$ ${compacto}`
}
