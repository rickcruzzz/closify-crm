import { z } from 'zod'

export const whatsappTemplateSchema = z.object({
  nomeDoModelo: z.string().min(1, 'Informe o nome do modelo aprovado na Meta.').max(512),
  idioma: z.string().min(2, 'Informe o código do idioma (ex: pt_BR).').max(10).default('pt_BR'),
  // Um parâmetro por linha — os modelos da Meta usam {{1}}, {{2}}... na ordem
  // em que os parâmetros são enviados.
  parametros: z.string().max(2000).optional(),
})

export type WhatsAppTemplateFormInput = z.input<typeof whatsappTemplateSchema>
export type WhatsAppTemplateFormValues = z.output<typeof whatsappTemplateSchema>
