import 'server-only'

import { asaasFetch, AsaasApiError } from '@/lib/asaas/client'
import { createClient } from '@/lib/supabase/server'

/**
 * Estado da assinatura para a tela de Cobrança.
 *
 * A tela mostrava apenas `workspaces.plan` (Free ou Pro) e nunca lia a tabela
 * `subscriptions`. Quem tinha assinatura criada com pagamento pendente via
 * "Free" e um botão de assinar de novo — sem aviso, sem link para pagar a
 * fatura que já existia, e sem forma de cancelar.
 */

export type FaturaPendente = {
  valor: number
  vencimento: string
  url: string
  /** `OVERDUE` no Asaas: passou do vencimento e ainda não foi pago. */
  vencida: boolean
}

export type EstadoAssinatura = {
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  temAssinaturaNoAsaas: boolean
  fatura: FaturaPendente | null
}

type AsaasPayment = {
  id: string
  status: string
  value: number
  dueDate: string
  invoiceUrl: string
}

export async function getEstadoAssinatura(
  workspaceId: string,
): Promise<EstadoAssinatura | null> {
  const supabase = await createClient()

  const { data: assinatura } = await supabase
    .from('subscriptions')
    .select('status, asaas_subscription_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!assinatura) return null

  const estado: EstadoAssinatura = {
    status: assinatura.status,
    temAssinaturaNoAsaas: !!assinatura.asaas_subscription_id,
    fatura: null,
  }

  if (!assinatura.asaas_subscription_id) return estado

  // A fatura em aberto vem do Asaas, não do nosso banco: o link de pagamento
  // (`invoiceUrl`) é gerado por eles e muda a cada ciclo. Guardar essa URL aqui
  // significaria servir link vencido no mês seguinte.
  try {
    const pagamentos = await asaasFetch<{ data: AsaasPayment[] }>(
      `/payments?subscription=${assinatura.asaas_subscription_id}&status=PENDING&limit=1`,
    )

    let pendente = pagamentos.data[0]

    if (!pendente) {
      const vencidos = await asaasFetch<{ data: AsaasPayment[] }>(
        `/payments?subscription=${assinatura.asaas_subscription_id}&status=OVERDUE&limit=1`,
      )
      pendente = vencidos.data[0]
    }

    if (pendente) {
      estado.fatura = {
        valor: pendente.value,
        vencimento: pendente.dueDate,
        url: pendente.invoiceUrl,
        vencida: pendente.status === 'OVERDUE',
      }
    }
  } catch (err) {
    // Falha ao consultar o Asaas não pode derrubar a tela inteira: sem a
    // fatura a pessoa ainda precisa ver o plano e o uso. Registra e segue.
    if (err instanceof AsaasApiError) {
      console.error(
        `getEstadoAssinatura: Asaas respondeu ${err.status} em ${err.path}`,
        err.body.slice(0, 300),
      )
    } else {
      console.error('getEstadoAssinatura: falha ao consultar o Asaas', err)
    }
  }

  return estado
}
