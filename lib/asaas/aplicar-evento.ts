import 'server-only'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { getResend } from '@/lib/resend/client'
import { renderPagamentoConfirmadoEmail } from '@/lib/emails/pagamento-confirmado'
import { renderPagamentoAtrasadoEmail } from '@/lib/emails/pagamento-atrasado'
import { enviarConversaoDeCompra } from '@/lib/analytics/meta-conversions'
import { PRO_PLAN_PRICE } from '@/lib/plans'
import { appUrl } from '@/lib/app-url'

export type StatusAssinatura = 'active' | 'past_due' | 'canceled'

export type ResultadoAplicacao =
  | { ok: true; duplicate: boolean; matched: boolean }
  | { ok: false }

/**
 * Aplica um status de assinatura vindo do Asaas, dedupe, RPC atômica
 * (status + plano) e os side effects que dependem dela (e-mail, conversão
 * pro Meta). Extraído do handler do webhook (`app/api/webhooks/asaas/route.ts`)
 * pra ser reusado pelo job de reconciliação (`app/api/cron/reconciliar-assinaturas/route.ts`),
 * que descobre o `status`/`subscriptionId` consultando a API do Asaas
 * direto em vez de receber um payload de webhook, o efeito, uma vez que se
 * sabe o status, é o mesmo dos dois caminhos.
 *
 * `origem` só entra no log, pra diferenciar no Vercel se a correção veio do
 * webhook em tempo real ou da varredura periódica.
 */
export async function aplicarEventoAsaas(params: {
  supabase: ReturnType<typeof createAdminClient>
  status: StatusAssinatura
  subscriptionId: string
  eventId: string
  eventType: string
  origem: string
}): Promise<ResultadoAplicacao> {
  const { supabase, status, subscriptionId, eventId, eventType, origem } = params

  // Idempotência: sem isso, reenviar um PAYMENT_CONFIRMED legítimo (retry do
  // Asaas, replay manual ou nova passada do job de reconciliação sobre o
  // mesmo pagamento) reativava plan='pro' depois de um cancelamento. O
  // insert com PK no id do evento é a trava, se já existe, o evento já foi
  // processado e não repetimos o efeito.
  const { error: dedupeError } = await supabase
    .from('asaas_webhook_events')
    .insert({ event_id: eventId, event_type: eventType })

  if (dedupeError) {
    // 23505 = unique_violation: evento repetido, não é erro.
    if (dedupeError.code === '23505') {
      return { ok: true, duplicate: true, matched: false }
    }
    console.error(`[${origem}] Asaas: falha ao registrar evento`, dedupeError)
    return { ok: false }
  }

  // Atualizar `subscriptions.status` e `workspaces.plan` em dois round-trips
  // deixava a porta aberta pra segunda escrita falhar e o plano ficar errado
  // em silêncio. A RPC faz as duas na mesma transação.
  const { data: matched, error } = await supabase.rpc('apply_asaas_subscription_status', {
    p_asaas_subscription_id: subscriptionId,
    p_status: status,
  })

  if (error) {
    // O registro de dedupe já foi gravado, então uma nova tentativa cairia
    // em 23505 sem nunca aplicar o status. Apagar a marca devolve o evento
    // pra fila: o próximo retry (webhook ou reconciliação) reprocessa de
    // verdade.
    await supabase.from('asaas_webhook_events').delete().eq('event_id', eventId)
    console.error(`[${origem}] Asaas: falha ao aplicar status da assinatura`, error)
    return { ok: false }
  }

  // Sem isso, quem confirma pagamento pelo webhook (o caminho normal,
  // ninguém está com a aba de Cobrança aberta esperando) via a tela
  // continuar mostrando fatura pendente até o cache do Next expirar
  // sozinho. `createCheckout`/`cancelSubscription` (lib/asaas/actions.ts)
  // já revalidam quando a MUDANÇA parte da própria pessoa; isto cobre o
  // caminho assíncrono, webhook em tempo real e o cron de reconciliação,
  // que também passa por esta função.
  if (matched === true) {
    revalidatePath('/settings/billing')
  }

  // Pagamento confirmado é o único momento em que o produto tinha algo a
  // dizer e ficava calado, liberação do Pro é assíncrona, sem aviso não dá
  // pra saber quando voltar a olhar.
  if (status === 'active' && matched === true) {
    await enviarEmailDoWebhook(supabase, subscriptionId, renderPagamentoConfirmadoEmail)
    await enviarConversaoParaMeta(supabase, subscriptionId, eventId)
  } else if (status === 'past_due' && matched === true) {
    await enviarEmailDoWebhook(supabase, subscriptionId, renderPagamentoAtrasadoEmail)
  }

  return { ok: true, duplicate: false, matched: matched === true }
}

/**
 * Busca o workspace e o e-mail do dono a partir da assinatura do Asaas.
 *
 * `created_by` é quem abriu a empresa e, pela regra do checkout, o único
 * que pode assinar, é para ele que a cobrança vai. Compartilhado entre
 * `enviarEmailDoWebhook` e `enviarConversaoParaMeta` pra não repetir as
 * mesmas três idas ao banco (subscriptions → workspaces → auth.admin) duas
 * vezes na mesma chamada.
 */
async function buscarAssinante(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
): Promise<{
  workspaceName: string
  email: string
  fbc: string | null
  fbp: string | null
} | null> {
  const { data: assinatura } = await supabase
    .from('subscriptions')
    .select('workspace_id')
    .eq('asaas_subscription_id', subscriptionId)
    .maybeSingle()

  if (!assinatura) return null

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, created_by, fbc, fbp')
    .eq('id', assinatura.workspace_id)
    .maybeSingle()

  if (!workspace?.created_by) return null

  const { data: dono } = await supabase.auth.admin.getUserById(workspace.created_by)
  const email = dono?.user?.email
  if (!email) return null

  return { workspaceName: workspace.name, email, fbc: workspace.fbc, fbp: workspace.fbp }
}

/**
 * Manda o e-mail correspondente ao status novo.
 *
 * Engole qualquer falha de propósito. O e-mail é aviso, não é o efeito: o
 * status já foi aplicado na transação anterior. Deixar uma exceção escapar
 * aqui faria o webhook responder 500, o Asaas reenviar o evento, e o dedupe
 * por `event_id`, que já gravou este evento, devolver sucesso sem
 * reprocessar nada.
 *
 * A idempotência do envio vem de graça do dedupe: um `event_id` só chega
 * aqui uma vez, então não há risco de mandar o mesmo e-mail duas vezes.
 */
async function enviarEmailDoWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  render: (params: { workspaceName: string; valor: number; appUrl: string }) => {
    subject: string
    html: string
  },
) {
  try {
    const assinante = await buscarAssinante(supabase, subscriptionId)
    if (!assinante) return

    const { subject, html } = render({
      workspaceName: assinante.workspaceName,
      valor: PRO_PLAN_PRICE,
      appUrl: appUrl(),
    })

    const { error } = await getResend().emails.send({
      from: 'Velo Funil <suporte@velofunil.com.br>',
      to: assinante.email,
      subject,
      html,
    })

    if (error) {
      console.error('Asaas: falha ao enviar e-mail', error)
    }
  } catch (err) {
    console.error('Asaas: erro ao enviar e-mail', err)
  }
}

/**
 * Avisa o Meta que um pagamento de verdade aconteceu, Conversions API,
 * server-side, sem depender do navegador de quem pagou (o checkout roda na
 * página hospedada do Asaas). Mesma idempotência do e-mail: `eventId` só
 * chega aqui uma vez por causa do dedupe em `asaas_webhook_events`.
 */
async function enviarConversaoParaMeta(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  eventId: string,
) {
  try {
    const assinante = await buscarAssinante(supabase, subscriptionId)
    if (!assinante) return

    await enviarConversaoDeCompra({
      email: assinante.email,
      valor: PRO_PLAN_PRICE,
      eventId,
      fbc: assinante.fbc,
      fbp: assinante.fbp,
    })
  } catch (err) {
    console.error('Asaas: erro ao enviar conversão pro Meta', err)
  }
}
