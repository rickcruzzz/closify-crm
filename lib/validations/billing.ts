import { z } from 'zod'

export const checkoutSchema = z.object({
  cpfCnpj: z
    .string()
    .min(1, 'Informe o CPF ou CNPJ.')
    .transform((value) => value.replace(/\D/g, ''))
    .refine((digits) => digits.length === 11 || digits.length === 14, {
      message: 'CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.',
    }),
})

export type CheckoutValues = z.infer<typeof checkoutSchema>
