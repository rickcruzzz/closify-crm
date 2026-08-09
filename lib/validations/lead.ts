import { z } from 'zod'

export const leadSchema = z.object({
  name: z.string().min(2, 'Informe o nome completo.'),
  email: z.string().min(1, 'Informe o e-mail.').pipe(z.email('E-mail inválido.')),
  phone: z.string().min(8, 'Informe um telefone válido.'),
  company: z.string().min(2, 'Informe a empresa.'),
  status: z.enum(
    ['novo', 'contato_realizado', 'proposta_enviada', 'negociacao', 'fechado_ganho', 'fechado_perdido'],
    { error: 'Selecione um status.' },
  ),
  ownerId: z.uuid('Selecione um responsável.'),
  value: z.coerce.number().min(0, 'O valor não pode ser negativo.'),
})

export type LeadFormInput = z.input<typeof leadSchema>
export type LeadFormValues = z.output<typeof leadSchema>

// Importação por CSV: o arquivo só traz Nome, Telefone, E-mail e Valor, então
// `company`, `status` e `ownerId` não vêm daqui — são preenchidos pela Server
// Action. Telefone é opcional porque a coluna `phone` aceita nulo e uma lista
// de e-mails sem telefone é um caso legítimo; e-mail continua obrigatório
// porque a coluna é `not null` no banco.
export const csvLeadSchema = z.object({
  name: z.string().min(2, 'Nome muito curto.'),
  email: z.string().min(1, 'E-mail obrigatório.').pipe(z.email('E-mail inválido.')),
  phone: z.string().max(40, 'Telefone longo demais.').nullable(),
  value: z.number().min(0, 'O valor não pode ser negativo.'),
})

export type CsvLeadValues = z.output<typeof csvLeadSchema>
