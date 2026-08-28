import { z } from '@/lib/validations/zod'

export const emailMessageSchema = z.object({
  assunto: z.string().min(1, 'Escreva um assunto.').max(200, 'Assunto muito longo.'),
  corpo: z.string().min(1, 'Escreva a mensagem.').max(5000, 'Mensagem muito longa.'),
})

export type EmailMessageFormInput = z.input<typeof emailMessageSchema>
export type EmailMessageFormValues = z.output<typeof emailMessageSchema>
