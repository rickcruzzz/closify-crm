import 'server-only'

import { asaasFetch, AsaasApiError } from '@/lib/asaas/client'
import type { StatusAssinatura } from '@/lib/asaas/aplicar-evento'

type AsaasPayment = {
  id: string
  status: string
  dateCreated: string
}

const STATUS_ATIVO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
const STATUS_ATRASADO = new Set(['OVERDUE'])
const STATUS_CANCELADO = new Set([
  'REFUNDED',
  'REFUND_REQUESTED',
  'REFUND_IN_PROGRESS',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
  'AWAITING_CHARGEBACK_REVERSAL',
  'DELETED',
])

export type PagamentoMaisRecente = {
  id: string
  statusMapeado: StatusAssinatura | null
}

/**
 * Descobre o status real de uma assinatura no Asaas a partir do pagamento
 * mais recente — pro job de reconciliação (`app/api/cron/reconciliar-assinaturas`)
 * comparar contra `subscriptions.status` no nosso banco.
 *
 * O Asaas não expõe um "status da assinatura" que corresponda 1:1 ao nosso
 * enum; o webhook decide o status a partir do nome do EVENTO
 * (`PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`...). Aqui não há evento, só a API —
 * então a mesma tabela de equivalência é reaplicada em cima do vocabulário
 * de `payment.status`, que é o campo que a API de fato devolve.
 */
export async function buscarPagamentoMaisRecente(
  asaasSubscriptionId: string,
): Promise<PagamentoMaisRecente | null> {
  try {
    const resposta = await asaasFetch<{ data: AsaasPayment[] }>(
      `/payments?subscription=${asaasSubscriptionId}&limit=10`,
    )

    if (resposta.data.length === 0) return null

    // Não confiar na ordem que o Asaas devolve: ordenar aqui por
    // `dateCreated` decrescente garante que a transação mais nova é a que
    // decide o status, não a primeira da página.
    const maisRecente = [...resposta.data].sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime(),
    )[0]

    let statusMapeado: StatusAssinatura | null = null
    if (STATUS_ATIVO.has(maisRecente.status)) statusMapeado = 'active'
    else if (STATUS_ATRASADO.has(maisRecente.status)) statusMapeado = 'past_due'
    else if (STATUS_CANCELADO.has(maisRecente.status)) statusMapeado = 'canceled'

    return { id: maisRecente.id, statusMapeado }
  } catch (err) {
    if (err instanceof AsaasApiError) {
      console.error(
        `buscarPagamentoMaisRecente: Asaas respondeu ${err.status} em ${err.path}`,
        err.body.slice(0, 300),
      )
    } else {
      console.error('buscarPagamentoMaisRecente: falha ao consultar o Asaas', err)
    }
    return null
  }
}
