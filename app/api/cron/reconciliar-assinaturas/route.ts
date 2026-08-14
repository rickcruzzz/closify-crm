import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { aplicarEventoAsaas, type StatusAssinatura } from '@/lib/asaas/aplicar-evento'
import { buscarPagamentoMaisRecente } from '@/lib/asaas/status-real'

// `timingSafeEqual` e o client admin (service role) não rodam no Edge — ver
// mesmo comentário em app/api/webhooks/asaas/route.ts.
export const runtime = 'nodejs'

/**
 * Rede de segurança pro caso do webhook do Asaas falhar em entregar (DNS
 * fora do ar, deploy no meio, timeout — qualquer motivo: o Asaas não
 * reenvia sozinho depois de uma falha). Roda 1x/dia via Vercel Cron
 * (`vercel.json`), varre assinaturas com status suspeito e corrige
 * comparando contra o status real no Asaas.
 *
 * Ver docs/estado-atual.md — mesmo padrão de webhook perdido que já
 * aconteceu (workspace "Orne", 13/08) e que ficava preso até alguém notar
 * na mão.
 */

function isValidCronSecret(authorizationHeader: string | null): boolean {
  const expected = process.env.CRON_SECRET
  if (!authorizationHeader || !expected) return false

  const prefixo = 'Bearer '
  if (!authorizationHeader.startsWith(prefixo)) return false
  const token = authorizationHeader.slice(prefixo.length)

  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

// Mesmo nome de evento que o webhook usaria pra este status (ver
// ACTIVE_EVENTS/PAST_DUE_EVENTS/CANCELED_EVENTS em
// app/api/webhooks/asaas/route.ts) — de propósito, não um nome "de
// reconciliação" à parte: o `eventId` monta em cima disso, e é isso que faz
// o dedupe reconhecer quando o webhook real (ou uma correção manual
// anterior) já processou o mesmo pagamento, evitando reenviar e-mail/Meta
// duplicado.
function eventoParaStatus(status: StatusAssinatura): string {
  if (status === 'active') return 'PAYMENT_RECEIVED'
  if (status === 'past_due') return 'PAYMENT_OVERDUE'
  return 'PAYMENT_REFUNDED'
}

export async function GET(request: Request) {
  if (!isValidCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: suspeitas, error } = await supabase
    .from('subscriptions')
    .select('workspace_id, asaas_subscription_id, status')
    .in('status', ['trialing', 'past_due'])
    .not('asaas_subscription_id', 'is', null)

  if (error) {
    console.error('Reconciliação Asaas: falha ao listar assinaturas suspeitas', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  const resumo = {
    verificadas: suspeitas.length,
    divergentes: 0,
    corrigidas: 0,
    correcoes: [] as Array<{
      workspace_id: string
      asaas_subscription_id: string
      de: string
      para: StatusAssinatura
    }>,
  }

  for (const linha of suspeitas) {
    // `asaas_subscription_id` filtrado por `.not(... 'is', null)` acima, mas
    // o tipo gerado continua nullable — o `!` aqui é seguro por causa do
    // filtro, não por suposição.
    const asaasSubscriptionId = linha.asaas_subscription_id!

    const pagamento = await buscarPagamentoMaisRecente(asaasSubscriptionId)
    if (!pagamento || !pagamento.statusMapeado) continue
    if (pagamento.statusMapeado === linha.status) continue

    resumo.divergentes += 1

    const eventType = eventoParaStatus(pagamento.statusMapeado)

    const resultado = await aplicarEventoAsaas({
      supabase,
      status: pagamento.statusMapeado,
      subscriptionId: asaasSubscriptionId,
      // Mesmo formato de dedupe que o webhook usaria pra este pagamento
      // (`evento:payment.id`) — se o webhook real ou uma correção manual já
      // processou esse pagamento específico, o dedupe barra aqui sozinho.
      eventId: `${eventType}:${pagamento.id}`,
      eventType,
      origem: 'reconciliacao:cron',
    })

    if (resultado.ok && !resultado.duplicate && resultado.matched) {
      resumo.corrigidas += 1
      const correcao = {
        workspace_id: linha.workspace_id,
        asaas_subscription_id: asaasSubscriptionId,
        de: linha.status,
        para: pagamento.statusMapeado,
      }
      resumo.correcoes.push(correcao)
      console.warn('Reconciliação Asaas: assinatura corrigida', correcao)
    }
  }

  return NextResponse.json(resumo)
}
