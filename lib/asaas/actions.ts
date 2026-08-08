'use server'

import { redirect } from 'next/navigation'

import { asaasFetch, AsaasApiError } from '@/lib/asaas/client'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { checkoutSchema } from '@/lib/validations/billing'
import { PRO_PLAN_PRICE } from '@/lib/plans'

type AsaasCustomer = { id: string }
type AsaasSubscription = { id: string }
type AsaasPayment = { id: string; invoiceUrl: string }
type AsaasPaymentList = { data: AsaasPayment[] }

export async function createCheckout(values: unknown) {
  const parsed = checkoutSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'CPF ou CNPJ inválido.' }
  }

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

  // externalReference fica opaco pro Asaas (eles só devolvem de volta nos
  // webhooks) — codifica workspace e usuário juntos aqui pra permitir
  // reconciliação/auditoria futura sem precisar de outra consulta.
  const externalReference = JSON.stringify({ workspaceId, userId: user.id })

  try {
    if (!customerId) {
      const customer = await asaasFetch<AsaasCustomer>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: workspace.name,
          email: user.email,
          cpfCnpj: parsed.data.cpfCnpj,
          externalReference,
        }),
      })
      customerId = customer.id
    } else {
      // Cliente pode já existir de uma tentativa anterior — a Asaas exige
      // CPF/CNPJ pra criar cobrança, então garante que está preenchido
      // mesmo num cliente reaproveitado (idempotente, sempre atualiza).
      await asaasFetch<AsaasCustomer>(`/customers/${customerId}`, {
        method: 'PUT',
        body: JSON.stringify({ cpfCnpj: parsed.data.cpfCnpj }),
      })
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
          externalReference,
        }),
      })
      subscriptionId = subscription.id
    }
  } catch (err) {
    // O status HTTP diz o que aconteceu sem precisar adivinhar: 401 é chave
    // de API errada ou desatualizada (segredo diferente do token do
    // webhook — não confundir os dois na hora de depurar), 400 costuma ser
    // campo inválido no corpo da requisição, 403 é permissão da conta Asaas.
    if (err instanceof AsaasApiError) {
      console.error(
        `createCheckout: Asaas respondeu ${err.status} em ${err.path}`,
        err.body.slice(0, 500),
      )
    } else {
      console.error('createCheckout: falha ao chamar a API do Asaas', err)
    }
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
