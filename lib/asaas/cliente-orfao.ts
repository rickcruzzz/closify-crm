import { AsaasApiError } from '@/lib/asaas/client'

/**
 * Decide se uma falha ao tocar num cliente do Asaas significa "este `cus_…`
 * não pertence a esta conta" — caso em que a saída é criar outro, não abortar
 * o checkout.
 *
 * ## Por que isto existe
 *
 * Em 31/08/2026 a conta do Asaas foi trocada inteira: o CNPJ do MEI foi
 * baixado em 08/08 e o gateway **não permite alterar o CNPJ de uma conta**
 * (regra deles, confirmada na documentação), então a única saída foi abrir
 * conta nova com a LTDA.
 *
 * Todo `asaas_customer_id` gravado em `subscriptions` antes disso aponta para
 * a conta velha. Medido no dia da migração: **13 das 15 linhas**. O checkout
 * lia esse id e mandava `PUT /customers/{id}` direto, sem conferir nada — e a
 * conta nova responde que não conhece aquele cliente. Resultado: o checkout
 * quebrava para todas as 13.
 *
 * ## É a metade que faltava de uma guarda que já existia
 *
 * `createCheckout` já validava o irmão deste campo. Em 19/08 a `pedro eee`
 * ficou presa em "Assinatura criada, mas não foi possível gerar o link de
 * pagamento" porque `asaas_subscription_id` apontava para uma assinatura
 * morta, e desde então `subscriptionId` só é reaproveitado quando o status
 * anterior não é `canceled`.
 *
 * `customerId`, na linha logo acima, ficou sem guarda nenhuma. O mesmo remédio
 * vale, por um gatilho diferente: lá era assinatura cancelada, aqui é conta
 * trocada.
 *
 * ## Por que 400 entra junto com 404
 *
 * O Asaas não é consistente ao recusar id desconhecido: já respondeu `404` e
 * já respondeu `400 invalid_object`. Aceitar os dois é seguro porque o efeito
 * é apenas **criar um cliente novo** em vez de reusar — no pior caso um
 * cadastro duplicado no gateway, contra um checkout que não completa.
 *
 * Erro de rede, tempo esgotado (`status` 0) e `401` continuam subindo: esses
 * não dizem nada sobre o cliente, e engoli-los transformaria "o Asaas está
 * fora do ar" em "crie tudo de novo", que é exatamente o tipo de retry cego
 * que gera cobrança duplicada.
 */
export function ehClienteDeOutraConta(erro: unknown): boolean {
  if (!(erro instanceof AsaasApiError)) return false
  return erro.status === 404 || erro.status === 400
}
