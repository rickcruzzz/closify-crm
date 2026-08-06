'use server'

import { redirect } from 'next/navigation'

import { asaasFetch } from '@/lib/asaas/client'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'

// Preço do plano Pro definido no PRD (docs/prd.md) — R$49/mês, colaboradores
// e leads ilimitados.
const PRO_PLAN_PRICE = 49

type AsaasCustomer = { id: string }
type AsaasSubscription = { id: string }
type AsaasPayment = { id: string; invoiceUrl: string }
type AsaasPaymentList = { data: AsaasPayment[] }

export async function createCheckout() {
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })
  if (!isAdmin) {
    return { error: 'Apenas administradores podem assinar o plano Pro.' }
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    return { error: 'Workspace não encontrado.' }
  }

  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('asaas_customer_id, asaas_subscription_id, status')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (existingSubscription?.status === 'active') {
    return { error: 'Este workspace já tem uma assinatura Pro ativa.' }
  }

  let customerId = existingSubscription?.asaas_customer_id ?? null
  let subscriptionId = existingSubscription?.asaas_subscription_id ?? null

  try {
    if (!customerId) {
      const customer = await asaasFetch<AsaasCustomer>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: workspace.name,
          email: user.email,
          externalReference: workspaceId,
        }),
      })
      customerId = customer.id
    }

    if (!subscriptionId) {
      const subscription = await asaasFetch<AsaasSubscription>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customer: customerId,
          billingType: 'UNDEFINED',
          cycle: 'MONTHLY',
          value: PRO_PLAN_PRICE,
          nextDueDate: new Date().toISOString().slice(0, 10),
          description: 'Closify CRM - Plano Pro',
          externalReference: workspaceId,
        }),
      })
      subscriptionId = subscription.id
    }
  } catch (err) {
    console.error('createCheckout: falha na API do Asaas', err)
    return { error: 'Não foi possível iniciar a assinatura no Asaas. Tente novamente.' }
  }

  // subscriptions não tem policy de insert/update pro client (só o webhook,
  // via service role, mexe no status de cobrança) — usa admin client aqui
  // de propósito, é a única escrita legítima fora do webhook porque só
  // grava customer_id/subscription_id, nunca o status de pagamento em si.
  const admin = createAdminClient()
  const { error: upsertError } = await admin.from('subscriptions').upsert(
    {
      workspace_id: workspaceId,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscriptionId,
      status: existingSubscription?.status ?? 'trialing',
    },
    { onConflict: 'workspace_id' },
  )

  if (upsertError) {
    console.error('createCheckout: falha ao salvar subscription', upsertError)
    return { error: 'Não foi possível iniciar a assinatura.' }
  }

  let invoiceUrl: string | undefined
  try {
    const payments = await asaasFetch<AsaasPaymentList>(
      `/payments?subscription=${subscriptionId}&limit=1`,
    )
    invoiceUrl = payments.data[0]?.invoiceUrl
  } catch (err) {
    console.error('createCheckout: falha ao buscar link de pagamento', err)
  }

  if (!invoiceUrl) {
    return { error: 'Assinatura criada, mas não foi possível gerar o link de pagamento.' }
  }

  redirect(invoiceUrl)
}
