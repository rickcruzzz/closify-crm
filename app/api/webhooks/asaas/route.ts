import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

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

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .update({ status })
    .eq('asaas_subscription_id', subscriptionId)
    .select('workspace_id')
    .maybeSingle()

  if (error) {
    console.error('Webhook Asaas: falha ao atualizar subscriptions', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  if (subscription) {
    await supabase
      .from('workspaces')
      .update({ plan: status === 'active' ? 'pro' : 'free' })
      .eq('id', subscription.workspace_id)
  }

  return NextResponse.json({ received: true })
}
