import { z } from 'zod'

export const dealSchema = z.object({
  title: z.string().min(2, 'Informe o título do negócio.'),
  leadId: z.string().min(1, 'Selecione um lead.'),
  value: z.coerce.number().min(0, 'O valor não pode ser negativo.'),
  stage: z.enum(
    [
      'novo',
      'contato_realizado',
      'proposta_enviada',
      'negociacao',
      'fechado_ganho',
      'fechado_perdido',
    ],
    { error: 'Selecione uma etapa.' },
  ),
  owner: z.string().min(1, 'Selecione um responsável.'),
  dueDate: z.string().min(1, 'Informe o prazo.'),
})

export type DealFormInput = z.input<typeof dealSchema>
export type DealFormValues = z.output<typeof dealSchema>
