import { z } from '@/lib/validations/zod'

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
    // pessoa via "Não foi possível iniciar a assinatura", mensagem que não
    // diz o que corrigir e faz parecer defeito do sistema.
    .refine(validarCpfCnpj, {
      message: 'Documento inválido. Confira os números digitados.',
    }),

  /**
   * Mensal ou anual, no vocabulário do Asaas.
   *
   * ## `.default()` e não `.catch()`, e a diferença custa dinheiro
   *
   * `.default()` age só na AUSÊNCIA do campo: quem não manda nada — todo
   * chamador que existia antes desta linha — continua mensal, correto. Mas um
   * valor DESCONHECIDO reprova a validação e aparece na tela.
   *
   * `.catch()` engoliria o desconhecido e devolveria mensal em silêncio. Num
   * campo que decide entre cobrar R$ 49 e R$ 490, silêncio é a pior resposta:
   * o dono venderia o anual na visita, o sistema cobraria o mensal, e nada na
   * tela diria que a escolha se perdeu.
   */
  ciclo: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),

  /**
   * Qual plano está sendo assinado.
   *
   * `.default('pro')` pelo mesmo motivo escrito acima para `ciclo`, e com o
   * mesmo cuidado: todo chamador que existia antes desta linha continua
   * assinando Pro, e um valor desconhecido **reprova** em vez de virar Pro em
   * silêncio.
   *
   * A diferença aqui é maior que a do ciclo. Entre Pro e Max há R$ 153 por mês
   * e um recurso que custa dinheiro do outro lado: engolir um valor estranho e
   * cobrar Pro entregaria uma instância de WhatsApp paga por R$ 97.
   */
  plano: z.enum(['pro', 'max']).default('pro'),
})

/** O que a Server Action recebe DEPOIS da validação: `ciclo` já resolvido. */
export type CheckoutValues = z.infer<typeof checkoutSchema>

/**
 * O que o formulário segura ANTES da validação, com `ciclo` opcional.
 *
 * São dois tipos porque `.default()` os torna diferentes, e o react-hook-form
 * precisa dos dois: ele guarda a entrada e entrega a saída ao `onSubmit`.
 * Usar só `z.infer` faz o resolver não bater com o formulário, e o erro que o
 * `tsc` dá para isso não menciona `default` em lugar nenhum.
 */
export type CheckoutInput = z.input<typeof checkoutSchema>

/** Confirmação exigida para cancelar a assinatura, digitada pela pessoa. */
export const cancelSubscriptionSchema = z.object({
  confirmacao: z.literal('CANCELAR', {
    error: 'Digite CANCELAR para confirmar.',
  }),
})
