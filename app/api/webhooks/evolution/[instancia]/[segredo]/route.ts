import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Recebe os eventos do Evolution API.
 *
 * ## O que esta rota resolve
 *
 * A dor que motivou a integração não é esquecer de responder — é o histórico
 * da conversa morar no celular do vendedor. Quando ele sai da empresa, some
 * contato, negociação em andamento e histórico de uma vez, e a empresa ainda
 * fica exposta na LGPD por não conseguir auditar nada.
 *
 * Cada mensagem que passa por aqui vira `activity` do lead. A empresa passa a
 * ser dona do próprio histórico, independentemente de quem atendeu ou de qual
 * aparelho.
 *
 * ## Por que o segredo vai na URL
 *
 * O Evolution não assina o payload (não há HMAC como no Asaas ou na Meta). O
 * único jeito de saber que o POST veio do nosso servidor é um segredo por
 * conexão embutido na própria URL do webhook, comparado com `timingSafeEqual`
 * — mesmo padrão de `lib/integrations/state.ts`.
 *
 * A URL vira credencial, então ela nunca aparece em tela nem em log.
 */
export const runtime = 'nodejs'

/**
 * Teto de execução explícito.
 *
 * Sem isso a rota herda o default da plataforma, e webhook que pendura segura
 * conexão do banco. O projeto já tem registro de uma função que levou 108s sem
 * explicação — 15s é folgado para o trabalho real daqui (3 a 4 idas ao banco)
 * e curto o bastante para falhar rápido quando algo travar.
 */
export const maxDuration = 15

/** Prazo da tarefa de follow-up, em horas. */
const PRAZO_DE_RESPOSTA_HORAS = 2

type MensagemDoEvolution = {
  key?: {
    id?: string
    remoteJid?: string
    /** `true` quando fomos NÓS que mandamos — não vira tarefa. */
    fromMe?: boolean
  }
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
    imageMessage?: { caption?: string }
    audioMessage?: unknown
    documentMessage?: { fileName?: string }
  }
  pushName?: string
  messageTimestamp?: number
}

type PayloadDoEvolution = {
  event?: string
  instance?: string
  data?: MensagemDoEvolution | MensagemDoEvolution[] | { state?: string }
}

function segredoConfere(recebido: string, esperado: string | undefined): boolean {
  if (!esperado) return false

  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  // `timingSafeEqual` estoura se os tamanhos diferem, e o próprio tamanho já
  // vaza informação — comparar antes evita as duas coisas.
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

/**
 * Extrai o texto de uma mensagem, seja qual for o tipo.
 *
 * Áudio, imagem e documento não têm texto puro; em vez de descartar (o cliente
 * mandou algo, e isso é informação), registra o tipo. Uma timeline que diz
 * "mandou um áudio" é melhor que uma que não diz nada.
 */
function textoDaMensagem(mensagem: MensagemDoEvolution): string {
  const m = mensagem.message
  if (!m) return '(mensagem sem conteúdo)'

  if (m.conversation) return m.conversation
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text
  if (m.imageMessage) return m.imageMessage.caption ?? '(enviou uma imagem)'
  if (m.audioMessage) return '(enviou um áudio)'
  if (m.documentMessage) return `(enviou um arquivo: ${m.documentMessage.fileName ?? 'sem nome'})`

  return '(mensagem de tipo não suportado)'
}

/** `5511999998888@s.whatsapp.net` vira `5511999998888`. Grupo devolve `null`. */
function telefoneDoRemetente(remoteJid: string | undefined): string | null {
  if (!remoteJid) return null
  // Mensagem de grupo termina em `@g.us` e não corresponde a um lead.
  if (remoteJid.endsWith('@g.us')) return null
  return remoteJid.split('@')[0] || null
}

export async function POST(
  requisicao: Request,
  { params }: { params: Promise<{ instancia: string; segredo: string }> },
) {
  const { instancia, segredo } = await params
  const admin = createAdminClient()

  // A conexão diz de qual empresa é esta instância, e guarda o segredo que
  // autentica a chamada.
  const { data: conexao } = await admin
    .from('integration_connections')
    .select('workspace_id, external_id, account_label')
    .eq('provider', 'whatsapp')
    .eq('external_id', instancia)
    .maybeSingle()

  // 404 e não 401: confirmar que a instância existe já entregaria informação a
  // quem está tentando adivinhar.
  if (!conexao || !segredoConfere(segredo, process.env.EVOLUTION_WEBHOOK_SECRET)) {
    return new NextResponse('Não encontrado.', { status: 404 })
  }

  let payload: PayloadDoEvolution
  try {
    payload = (await requisicao.json()) as PayloadDoEvolution
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 })
  }

  // O número caiu. Marcar como erro é o que faz a tela avisar em vez de deixar
  // a pessoa achando que está tudo certo — numa API não oficial, queda é o
  // evento que não pode passar despercebido.
  if (payload.event === 'connection.update') {
    const estado = (payload.data as { state?: string } | undefined)?.state

    if (estado === 'close') {
      await admin
        .from('integration_connections')
        .update({ status: 'error', last_error: 'O WhatsApp desconectou.' })
        .eq('provider', 'whatsapp')
        .eq('external_id', instancia)
    } else if (estado === 'open') {
      await admin
        .from('integration_connections')
        .update({ status: 'connected', last_error: null })
        .eq('provider', 'whatsapp')
        .eq('external_id', instancia)
    }

    return NextResponse.json({ ok: true })
  }

  if (payload.event !== 'messages.upsert') {
    // Evento que não assinamos. Responder 200 evita que o Evolution fique
    // reenviando algo que nunca vamos processar.
    return NextResponse.json({ ok: true, ignorado: payload.event })
  }

  const mensagens = Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data as MensagemDoEvolution]
      : []

  for (const mensagem of mensagens) {
    const eventId = mensagem.key?.id
    if (!eventId) continue

    // Mensagem que NÓS enviamos volta como evento também. Registrar viraria
    // eco: a atividade já foi criada no momento do envio.
    if (mensagem.key?.fromMe) continue

    const telefone = telefoneDoRemetente(mensagem.key?.remoteJid)
    if (!telefone) continue

    // Dedupe antes de qualquer escrita: o Evolution reenvia em caso de falha
    // de rede, e sem isso a timeline encheria de duplicata. `23505` é
    // unique_violation — evento repetido, não é erro.
    const { error: erroDedupe } = await admin
      .from('whatsapp_webhook_events')
      .insert({ event_id: `${instancia}:${eventId}` })

    if (erroDedupe) {
      if (erroDedupe.code === '23505') continue
      console.error('Webhook Evolution: falha ao gravar dedupe', erroDedupe)
      continue
    }

    // Casamento por RPC, não buscando todos os leads em memória: o código
    // anterior desta integração varria o workspace inteiro por mensagem, o que
    // com 3.000 leads significava 3.000 linhas lidas a cada "oi". Ver a
    // migration 0047.
    const { data: encontrado } = await admin.rpc('encontrar_lead_por_telefone', {
      p_workspace_id: conexao.workspace_id,
      p_telefone: telefone,
    })

    let lead = encontrado as string | null

    // Número desconhecido é cliente novo chegando pelo WhatsApp. Criar o lead
    // é o que faz ele entrar no funil em vez de virar mensagem solta — e é
    // exatamente o "não perder venda" que o produto promete.
    if (!lead) {
      const { data: novo, error: erroLead } = await admin
        .from('leads')
        .insert({
          workspace_id: conexao.workspace_id,
          name: mensagem.pushName?.trim() || `WhatsApp ${telefone.slice(-4)}`,
          // Sem e-mail, e isso e legitimo: a migration 0025 tornou a coluna
          // nullable exatamente porque a lista do publico-alvo e de WhatsApp.
          // Com `email not null`, a importacao de planilha trazia zero linhas.
          email: null,
          phone: telefone,
          status: 'novo',
        })
        .select('id')
        .single()

      // Falha ao criar lead (teto de plano, por exemplo) não pode derrubar o
      // webhook: o dedupe já foi gravado, e devolver erro faria o Evolution
      // reenviar algo que vai falhar de novo pelo mesmo motivo.
      if (erroLead || !novo) {
        console.error('Webhook Evolution: não consegui criar o lead', erroLead)
        continue
      }

      lead = novo.id
    }

    await admin.from('activities').insert({
      workspace_id: conexao.workspace_id,
      lead_id: lead,
      type: 'nota',
      description: `WhatsApp: ${textoDaMensagem(mensagem)}`,
      integration_provider: 'whatsapp',
    })

    // Cliente que responde sem tarefa aberta é exatamente a venda que se perde
    // por esquecimento. A tarefa nasce com prazo curto de propósito: dentro da
    // janela em que responder ainda parece atendimento, não desculpa.
    const { data: tarefaAberta } = await admin
      .from('tasks')
      .select('id')
      .eq('workspace_id', conexao.workspace_id)
      .eq('lead_id', lead)
      .is('done_at', null)
      .limit(1)
      .maybeSingle()

    if (!tarefaAberta) {
      await admin.from('tasks').insert({
        workspace_id: conexao.workspace_id,
        lead_id: lead,
        title: 'Responder no WhatsApp',
        type: 'nota',
        due_at: new Date(Date.now() + PRAZO_DE_RESPOSTA_HORAS * 60 * 60 * 1000).toISOString(),
      })
    }
  }

  return NextResponse.json({ ok: true })
}
