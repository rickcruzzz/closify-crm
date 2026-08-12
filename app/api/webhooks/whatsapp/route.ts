import { NextResponse, type NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { validarAssinaturaWebhook, verificarTokenDoWebhook } from '@/lib/integrations/whatsapp'
import { apenasDigitos } from '@/lib/leads/planilha'

// `node:crypto` (HMAC) e a service role não rodam no Edge — mesmo motivo do
// webhook do Asaas.
export const runtime = 'nodejs'

type ValorDoWebhook = {
  metadata?: { phone_number_id?: string }
  messages?: {
    id: string
    from: string
    timestamp: string
    type: string
    text?: { body?: string }
  }[]
}

type PayloadDoWebhook = {
  entry?: {
    id?: string
    changes?: { field?: string; value?: ValorDoWebhook }[]
  }[]
}

/**
 * Handshake de verificação que a Meta faz uma vez, ao configurar a URL do
 * webhook no painel do App. Sem responder o `hub.challenge` exatamente como
 * recebido, a Meta recusa salvar a configuração.
 */
export function GET(request: NextRequest) {
  const modo = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')

  if (modo === 'subscribe' && verificarTokenDoWebhook(token) && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

/**
 * Últimos 8 dígitos — número de assinante, sem DDD nem DDI.
 *
 * Comparação intencionalmente frouxa: o `wa_id` que a Meta manda vem sempre
 * com DDI (`55...`), enquanto `leads.phone` foi digitado à mão ou importado
 * de planilha em qualquer formato. Comparar os últimos 8 dígitos casa os dois
 * sem precisar normalizar DDD/nono dígito em cada lado. Risco aceito e
 * documentado: dois leads com os mesmos últimos 8 dígitos em DDDs diferentes
 * colidiriam — raro, e o pior efeito é a mensagem cair no lead errado, não
 * vazar para outra empresa (a busca já é restrita ao workspace do número).
 */
function mesmoAssinante(a: string, b: string): boolean {
  const da = apenasDigitos(a)
  const db = apenasDigitos(b)
  if (da.length < 8 || db.length < 8) return false
  return da.slice(-8) === db.slice(-8)
}

export async function POST(request: NextRequest) {
  const corpoCru = await request.text()

  if (!validarAssinaturaWebhook(corpoCru, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: PayloadDoWebhook
  try {
    payload = JSON.parse(corpoCru)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const admin = createAdminClient()

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      const phoneNumberId = change.value?.metadata?.phone_number_id
      const mensagens = change.value?.messages ?? []
      if (!phoneNumberId || mensagens.length === 0) continue

      const { data: conexao } = await admin
        .from('integration_connections')
        .select('workspace_id')
        .eq('provider', 'whatsapp')
        .eq('external_id', phoneNumberId)
        .eq('status', 'connected')
        .maybeSingle()

      // Número que não está conectado a workspace nenhum (desconectado
      // depois do envio, ou evento de teste da Meta) — não é erro, só não há
      // onde gravar.
      if (!conexao) continue

      for (const mensagem of mensagens) {
        // Idempotência: mesmo desenho de `asaas_webhook_events`. A Meta
        // reenvia webhook que não recebeu 200 a tempo.
        const { error: dedupeError } = await admin
          .from('whatsapp_webhook_events')
          .insert({ event_id: mensagem.id })

        if (dedupeError) {
          if (dedupeError.code === '23505') continue // duplicata, já processada
          console.error('Webhook WhatsApp: falha ao registrar dedupe', dedupeError)
          continue
        }

        const { data: leads } = await admin
          .from('leads')
          .select('id, phone')
          .eq('workspace_id', conexao.workspace_id)
          .not('phone', 'is', null)

        const lead = (leads ?? []).find((l) => l.phone && mesmoAssinante(l.phone, mensagem.from))

        if (!lead) {
          // Mensagem de um número que não bate com nenhum lead — fica só no
          // log. Criar lead automaticamente a partir de mensagem recebida é
          // decisão de produto que este ciclo não toma.
          console.info('Webhook WhatsApp: mensagem de número sem lead correspondente', {
            workspaceId: conexao.workspace_id,
          })
          continue
        }

        const texto = mensagem.text?.body ?? `[mensagem do tipo ${mensagem.type}]`

        await admin.from('activities').insert({
          workspace_id: conexao.workspace_id,
          lead_id: lead.id,
          author_id: null,
          type: 'nota',
          description: `WhatsApp recebido: ${texto}`,
        })

        // Sem tarefa aberta pro lead: uma resposta de cliente sem follow-up
        // agendado é exatamente o "esqueci de responder" que o produto existe
        // para evitar. Cria a tarefa em vez de só anotar na timeline.
        const { data: tarefaAberta } = await admin
          .from('tasks')
          .select('id')
          .eq('lead_id', lead.id)
          .is('done_at', null)
          .limit(1)
          .maybeSingle()

        if (!tarefaAberta) {
          await admin.from('tasks').insert({
            workspace_id: conexao.workspace_id,
            lead_id: lead.id,
            title: 'Responder no WhatsApp',
            type: 'nota',
            due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
