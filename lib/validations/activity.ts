import { z } from 'zod'

export const activitySchema = z.object({
  type: z.enum(['ligacao', 'email', 'reuniao', 'nota'], { error: 'Selecione um tipo.' }),
  description: z.string().min(2, 'Descreva a atividade.'),
})

export type ActivityFormInput = z.input<typeof activitySchema>
export type ActivityFormValues = z.output<typeof activitySchema>
