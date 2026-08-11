import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getResend } from '@/lib/resend/client'
import { renderPagamentoConfirmadoEmail } from '@/lib/emails/pagamento-confirmado'
import { PRO_PLAN_PRICE } from '@/lib/plans'
import { appUrl } from '@/lib/app-url'

// `timingSafeEqual` vem de `node:crypto` e o client admin usa a service role
// key: nada disso pode rodar no runtime Edge. O padrão do Next 14 para route
// handlers já é `nodejs`, mas deixar explícito evita que uma mudança de
// config global mova o webhook de runtime sem ninguém perceber.
export const runtime = 'nodejs'

const ACTIVE_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])
const PAST_DUE_EVENTS = new Set(['PAYMENT_OVERDUE'])
const CANCELED_EVENTS = new Set([
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_INACTIVATED',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
])

type AsaasWebhookPayload = {
  id?: string
  event?: string
  payment?: { id?: string; subscription?: string }
  subscription?: { id?: string }
}

function isValidToken(received: string | null): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (!received || !expected) return false

  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  // timingSafeEqual exige buffers do mesmo tamanho — comparar tamanho antes
  // não vaza mais informação do que o próprio token já expõe (comprimento
  // não é segredo), mas evita lançar exceção quando tamanhos divergem.
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!isValidToken(request.headers.get('asaas-access-token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: AsaasWebhookPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const event = body.event
  const subscriptionId = body.subscription?.id ?? body.payment?.subscription

  // Evento sem assinatura vinculada (ex: cobrança avulsa) ou tipo que ainda
  // não mapeamos — não é erro, só não há o que atualizar. Responde 200 pra
  // Asaas não ficar reenviando o mesmo evento em retry.
  if (!event || !subscriptionId) {
    return NextResponse.json({ received: true })
  }

  let status: 'active' | 'past_due' | 'canceled' | null = null
  if (ACTIVE_EVENTS.has(event)) status = 'active'
  else if (PAST_DUE_EVENTS.has(event)) status = 'past_due'
  else if (CANCELED_EVENTS.has(event)) status = 'canceled'

  if (!status) {
    return NextResponse.json({ received: true })
  }

  const supabase = createAdminClient()

  // Idempotência: sem isso, reenviar um PAYMENT_CONFIRMED legítimo (retry do
  // Asaas ou replay por quem tivesse o token) reativava plan='pro' depois de
  // um cancelamento. O insert com PK no id do evento é a trava — se já
  // existe, o evento já foi processado e não repetimos o efeito.
  const eventId = body.id ?? `${event}:${body.payment?.id ?? subscriptionId}`

  const { error: dedupeError } = await supabase
    .from('asaas_webhook_events')
    .insert({ event_id: eventId, event_type: event })

  if (dedupeError) {
    // 23505 = unique_violation: evento repetido. Responde 200 pra Asaas parar
    // de reenviar; qualquer outro erro é falha real de infra.
    if (dedupeError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('Webhook Asaas: falha ao registrar evento', dedupeError)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  // Atualizar `subscriptions.status` e `workspaces.plan` em dois round-trips
  // deixava a porta aberta pra segunda escrita falhar e o plano ficar errado
  // em silêncio — e, como o evento já estava registrado acima, nenhum retry
  // do Asaas consertava. A RPC faz as duas na mesma transação.
  const { data: matched, error } = await supabase.rpc('apply_asaas_subscription_status', {
    p_asaas_subscription_id: subscriptionId,
    p_status: status,
  })

  if (error) {
    // O registro de dedupe já foi gravado, então um retry cairia no 23505 e
    // responderia 200 sem nunca processar o evento. Apagar a marca devolve o
    // evento pra fila: o próximo retry do Asaas reprocessa de verdade.
    await supabase.from('asaas_webhook_events').delete().eq('event_id', eventId)

    console.error('Webhook Asaas: falha ao aplicar status da assinatura', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  // Pagamento confirmado é o único momento em que o produto tinha algo a dizer
  // e ficava calado. A pessoa pagava — muitas vezes por Pix, fora do horário
  // comercial — e a única confirmação era a fatura do próprio Asaas, que traz a
  // razão social do MEI e não a marca. Como a liberação do Pro é assíncrona,
  // ela não tinha como saber quando voltar a olhar.
  if (status === 'active' && matched === true) {
    await avisarPagamentoConfirmado(supabase, subscriptionId)
  }

  // Assinatura que não é nossa (ou já removida): não é erro. Responde 200 pro
  // Asaas parar de reenviar.
  return NextResponse.json({ received: true, matched: matched === true })
}

/**
 * Manda o e-mail de "Pro ativado".
 *
 * Engole qualquer falha de propósito. O e-mail é aviso, não é o efeito: o Pro
 * já foi liberado na transação anterior. Deixar uma exceção escapar aqui faria
 * o webhook responder 500, o Asaas reenviar o evento, e o dedupe por `event_id`
 * — que já gravou este evento — devolver 200 sem reprocessar nada. Ou seja: um
 * Resend fora do ar viraria pagamento sem confirmação e sem retentativa útil.
 *
 * A idempotência do envio vem de graça do dedupe: um `event_id` só chega aqui
 * uma vez, então não há risco de mandar o mesmo e-mail duas vezes.
 */
async function avisarPagamentoConfirmado(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
) {
  try {
    const { data: assinatura } = await supabase
      .from('subscriptions')
      .select('workspace_id')
      .eq('asaas_subscription_id', subscriptionId)
      .maybeSingle()

    if (!assinatura) return

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, created_by')
      .eq('id', assinatura.workspace_id)
      .maybeSingle()

    // `created_by` é quem abriu a empresa e, pela regra do checkout, o único
    // que pode assinar — é para ele que a cobrança vai.
    if (!workspace?.created_by) return

    const { data: dono } = await supabase.auth.admin.getUserById(workspace.created_by)
    const destinatario = dono?.user?.email
    if (!destinatario) return

    const { subject, html } = renderPagamentoConfirmadoEmail({
      workspaceName: workspace.name,
      valor: PRO_PLAN_PRICE,
      appUrl: appUrl(),
    })

    const { error } = await getResend().emails.send({
      from: 'Velo Funil <suporte@velofunil.com.br>',
      to: destinatario,
      subject,
      html,
    })

    if (error) {
      console.error('Webhook Asaas: falha ao enviar e-mail de pagamento', error)
    }
  } catch (err) {
    console.error('Webhook Asaas: erro ao avisar pagamento confirmado', err)
  }
}
