import { validarCnpj } from '@/lib/documento-br'
import { z } from '@/lib/validations/zod'

/** Tira máscara. O banco guarda só dígitos, ele recusa o resto. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * CNPJ pelos dois dígitos verificadores.
 *
 * ## Uma implementação só, e ela mora em `documento-br.ts`
 *
 * Até 23/09 havia DUAS: esta e `validarCnpj`, com a mesma matemática escrita
 * de jeitos diferentes. `lib/validations/billing.ts` usava uma e o
 * `empresaSchema` abaixo usava a outra, ou seja o produto tinha duas respostas
 * possíveis para *"este CNPJ vale?"*.
 *
 * Só uma tinha teste. A que não tinha era esta.
 *
 * **Medido antes de trocar**, porque colapsar duas implementações sem provar
 * que elas concordam é trocar um defeito conhecido por um desconhecido: onze
 * casos fixos, incluindo o CNPJ do próprio projeto e um dígito adulterado,
 * mais 200.000 sorteios aleatórios. **Zero divergências.**
 *
 * O motivo de ela existir continua valendo e fica escrito: checar só "tem 14
 * dígitos" aceita `11111111111111`, que é o que sai quando alguém quer pular o
 * campo. Como o CNPJ aqui é OPCIONAL, quem não tem deixa em branco, então
 * preencher errado é engano de digitação e vale avisar.
 */
export const cnpjValido = validarCnpj

/**
 * As 27 unidades federativas, com nome.
 *
 * Exportada porque a tela mostra o NOME e guarda a SIGLA, o banco tem
 * `check (estado ~ '^[A-Z]{2}$')`. Duas listas, uma aqui e outra no
 * componente, é a primeira a ficar desatualizada.
 */
export const UNIDADES_FEDERATIVAS = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
] as const

const UFS = UNIDADES_FEDERATIVAS.map((u) => u.sigla)

/**
 * Campo opcional de texto: vazio vira `null`, não string vazia.
 *
 * Sem isto, apagar o campo na tela gravaria `''`, e `''` não é ausência, a
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
    .refine((v) => v == null || UFS.includes(v as (typeof UFS)[number]), {
      error: 'UF inválida.',
    }),
})

export type EmpresaFormInput = z.input<typeof empresaSchema>
export type EmpresaFormValues = z.output<typeof empresaSchema>
