import { z } from 'zod'

/** Tira máscara. O banco guarda só dígitos — ele recusa o resto. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * CNPJ pelos dois dígitos verificadores, não pelo tamanho.
 *
 * Checar só "tem 14 dígitos" aceita `11111111111111`, que é o que sai quando
 * alguém quer pular o campo. Como o CNPJ aqui é OPCIONAL, quem não tem deixa
 * em branco — então preencher errado é engano de digitação, e vale avisar.
 */
export function cnpjValido(valor: string): boolean {
  const n = somenteDigitos(valor)
  if (n.length !== 14) return false

  // Todos os dígitos iguais passam na conta dos verificadores e não existem.
  if (/^(\d)\1{13}$/.test(n)) return false

  const digito = (base: string, pesoInicial: number): number => {
    let peso = pesoInicial
    let soma = 0
    for (const char of base) {
      soma += Number(char) * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  return (
    digito(n.slice(0, 12), 5) === Number(n[12]) &&
    digito(n.slice(0, 13), 6) === Number(n[13])
  )
}

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const

/**
 * Campo opcional de texto: vazio vira `null`, não string vazia.
 *
 * Sem isto, apagar o campo na tela gravaria `''`, e `''` não é ausência — a
 * tela mostraria um campo "preenchido" com nada dentro, e o `coalesce` do
 * banco trataria como valor.
 */
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v))
    .nullish()

/** Telefone brasileiro em dígitos: DDD + 8 ou 9. */
const telefoneOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : somenteDigitos(v)))
  .nullish()
  .refine((v) => v == null || (v.length >= 10 && v.length <= 13), {
    error: 'Telefone incompleto. Informe com DDD.',
  })

export const empresaSchema = z.object({
  // O único obrigatório: uma empresa sem nome não tem como aparecer no seletor
  // de empresas nem no topo da tela.
  name: z.string().trim().min(2, 'Informe o nome da empresa.').max(80, 'Nome longo demais.'),

  nome_fantasia: opcional(120),
  segmento: opcional(40),
  descricao: opcional(500),

  cnpj: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : somenteDigitos(v)))
    .nullish()
    .refine((v) => v == null || cnpjValido(v), { error: 'CNPJ inválido. Confira os números.' }),

  email_comercial: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v.toLowerCase()))
    .nullish()
    .refine((v) => v == null || z.email().safeParse(v).success, { error: 'E-mail inválido.' }),

  whatsapp: telefoneOpcional,
  telefone: telefoneOpcional,

  // Aceita "velofunil.com.br" e guarda "https://velofunil.com.br". Sem isto o
  // link da tela viraria relativo e mandaria a pessoa para dentro do app.
  site: z
    .string()
    .trim()
    .transform((v) => {
      if (v === '') return null
      return /^https?:\/\//i.test(v) ? v : `https://${v}`
    })
    .nullish()
    .refine((v) => v == null || z.url().safeParse(v).success, { error: 'Endereço de site inválido.' }),

  cep: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : somenteDigitos(v)))
    .nullish()
    .refine((v) => v == null || v.length === 8, { error: 'CEP deve ter 8 dígitos.' }),

  endereco: opcional(160),
  numero: opcional(20),
  complemento: opcional(80),
  bairro: opcional(80),
  cidade: opcional(80),

  estado: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v.toUpperCase()))
    .nullish()
    .refine((v) => v == null || (UFS as readonly string[]).includes(v), {
      error: 'UF inválida.',
    }),
})

export type EmpresaFormInput = z.input<typeof empresaSchema>
export type EmpresaFormValues = z.output<typeof empresaSchema>
