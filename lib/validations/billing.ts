import { z } from 'zod'

import { validarCpfCnpj } from '@/lib/documento-br'

export const checkoutSchema = z.object({
  cpfCnpj: z
    .string()
    .min(1, 'Informe o CPF ou CNPJ.')
    .transform((value) => value.replace(/\D/g, ''))
    .refine((digits) => digits.length === 11 || digits.length === 14, {
      message: 'CPF tem 11 dígitos e CNPJ tem 14. Confira o que foi digitado.',
    })
    // Confere o dígito verificador aqui, antes de qualquer chamada de rede.
    // Sem isso, um número digitado errado só era recusado lá no Asaas, e a
    // pessoa via "Não foi possível iniciar a assinatura" — mensagem que não
    // diz o que corrigir e faz parecer defeito do sistema.
    .refine(validarCpfCnpj, {
      message: 'Documento inválido. Confira os números digitados.',
    }),
})

export type CheckoutValues = z.infer<typeof checkoutSchema>

/** Confirmação exigida para cancelar a assinatura, digitada pela pessoa. */
export const cancelSubscriptionSchema = z.object({
  confirmacao: z.literal('CANCELAR', {
    error: 'Digite CANCELAR para confirmar.',
  }),
})
