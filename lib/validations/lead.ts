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
