'use server'

import { revalidatePath } from 'next/cache'

import { asaasFetch, AsaasApiError } from '@/lib/asaas/client'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { cancelSubscriptionSchema, checkoutSchema } from '@/lib/validations/billing'
import { PRO_PLAN_PRICE } from '@/lib/plans'
import { CONTROLADOR } from '@/lib/legal'

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
  //
  // O formato JSON `{"workspaceId":"<uuid>","userId":"<uuid>"}` tem 106
  // caracteres e o Asaas rejeita acima de 100 com
  // `400 invalid_object: O identificador externo não deve ultrapassar 100
  // caracteres`. Estourava para todo usuário, sempre, porque UUID tem tamanho
  // fixo — não era caso de borda.
  //
  // Dois UUIDs separados por `:` dão 73 caracteres e carregam a mesma
  // informação. Quem lê isso depois faz `split(':')`.
  const externalReference = `${workspaceId}:${user.id}`

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
          // Aparece na fatura, no boleto e no extrato do cartão. É o único
          // texto de marca que controlamos nessa tela: o nome do recebedor vem
          // do cadastro da conta Asaas e, em MEI, é a razão social da Receita —
          // aqui, um CNPJ seguido do nome civil do titular. Trinta dias depois
          // da compra, ninguém reconhece aquilo, e é dessa não-identificação
          // que nasce a contestação.
          //
          // Por isso a descrição carrega três coisas, nesta ordem: a marca que
          // a pessoa reconhece, o que ela está pagando, e o canal para
          // perguntar antes de contestar. O e-mail entra no lugar da URL
          // porque quem não reconheceu a cobrança precisa FALAR com alguém, e
          // não visitar um site.
          //
          // Só vale para assinaturas novas — as já criadas mantêm a descrição
          // gravada no Asaas, que é a fonte da verdade da cobrança.
          description: `Velo Funil — Plano Pro · CRM de vendas · Assinatura mensal · ${CONTROLADOR.email}`,
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

  // Devolve a URL em vez de fazer `redirect(invoiceUrl)`.
  //
  // Com o redirect, a pessoa saía do produto e não voltava: pagava na página do
  // Asaas e ficava lá. A saída natural seria o `callback.successUrl` do Asaas,
  // mas ele **não funciona** — testado contra a API em 11/08/2026: o
  // `POST /subscriptions` aceita o campo com HTTP 200, não o devolve na
  // leitura, não propaga para a cobrança gerada, e o `PUT /payments` com
  // `callback` responde 500.
  //
  // Sem cooperação do Asaas, o retorno tem que ser nosso: quem chama abre a
  // fatura em outra aba e mantém esta em `/settings/billing?pago=1`.
  return { url: invoiceUrl }
}

/**
 * Cancela a assinatura Pro do workspace.
 *
 * Ordem deliberada: cancela PRIMEIRO no Asaas, depois marca no banco. O Asaas
 * é quem de fato cobra — se a ordem fosse invertida e a chamada remota
 * falhasse, o app mostraria "cancelado" enquanto a fatura continuaria caindo
 * todo mês. Melhor a pessoa ver um erro e tentar de novo do que acreditar num
 * cancelamento que não aconteceu.
 *
 * O plano volta para `free` junto: manter Pro sem assinatura ativa é o mesmo
 * defeito que a auditoria encontrou no workspace de seed.
 */
export async function cancelSubscription(values: unknown) {
  const parsed = cancelSubscriptionSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Digite CANCELAR para confirmar.' }
  }

  const { workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })
  if (!isAdmin) {
    return { error: 'Apenas administradores podem cancelar a assinatura.' }
  }

  const { data: assinatura } = await supabase
    .from('subscriptions')
    .select('asaas_subscription_id, status')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!assinatura?.asaas_subscription_id) {
    return { error: 'Não há assinatura ativa para cancelar.' }
  }

  if (assinatura.status === 'canceled') {
    return { error: 'Esta assinatura já foi cancelada.' }
  }

  try {
    await asaasFetch(`/subscriptions/${assinatura.asaas_subscription_id}`, {
      method: 'DELETE',
    })
  } catch (err) {
    if (err instanceof AsaasApiError) {
      console.error(
        `cancelSubscription: Asaas respondeu ${err.status} em ${err.path}`,
        err.body.slice(0, 500),
      )
      // 404 significa que a assinatura já não existe lá — seguir e acertar o
      // banco é o resultado correto, não um erro para a pessoa.
      if (err.status !== 404) {
        return {
          error: 'Não foi possível cancelar no Asaas. Tente novamente em instantes.',
        }
      }
    } else {
      console.error('cancelSubscription: falha ao chamar o Asaas', err)
      return { error: 'Não foi possível cancelar a assinatura. Tente novamente.' }
    }
  }

  // `subscriptions` e `workspaces.plan` não têm policy de escrita para o
  // client — o webhook é quem mexe nisso, via service role. Mesma justificativa
  // do upsert em `createCheckout`.
  const admin = createAdminClient()

  const { error: erroStatus } = await admin
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('workspace_id', workspaceId)

  const { error: erroPlano } = await admin
    .from('workspaces')
    .update({ plan: 'free' })
    .eq('id', workspaceId)

  if (erroStatus || erroPlano) {
    // A cobrança JÁ parou no Asaas neste ponto. Deixar o app achando que ainda
    // é Pro é o lado seguro do erro, e o log permite acertar à mão.
    console.error('cancelSubscription: cancelou no Asaas mas falhou no banco', {
      workspaceId,
      erroStatus,
      erroPlano,
    })
    return {
      error:
        'A cobrança foi cancelada, mas houve falha ao atualizar sua conta. Fale com o suporte.',
    }
  }

  revalidatePath('/settings/billing')
  revalidatePath('/settings')
  return { success: true }
}
