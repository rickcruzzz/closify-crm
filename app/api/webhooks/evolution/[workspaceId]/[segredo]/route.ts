import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Recebe os eventos do Evolution GO.
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
 * ## Evolution GO, não Evolution API (Node/Baileys)
 *
 * A VPS roda `github.com/EvolutionAPI/evolution-go` (whatsmeow), confirmado
 * pelo Swagger do servidor em 21/08 — API diferente da que o resto do
 * projeto foi originalmente escrito pra consumir. O formato dos campos de
 * mensagem (`isFromMe`, `pushName`, `chat`) é o de `types.MessageInfo` do
 * `whatsmeow`, lido do schema do Swagger.
 *
 * ## Nome do evento não é o nome da assinatura
 *
 * `/instance/connect` recebe `subscribe: ['MESSAGE', 'CONNECTION']`, mas
 * esses são os nomes das CATEGORIAS assinadas. O que chega no corpo do
 * webhook são os tipos de evento do `whatsmeow`: `Message`, `Connected`,
 * `LoggedOut`, `QRCode`, `QRTimeout`.
 *
 * Isso custou um bug real: a primeira versão filtrava por `CONNECTION` e
 * `MESSAGE`, e o log do servidor mostrava a rota respondendo
 * `{"ok":true,"ignorado":"LoggedOut"}` — ou seja, ignorando tudo, e teria
 * ignorado a primeira mensagem de cliente do mesmo jeito. Confirmado em
 * 22/08 lendo `/instance/logs/{id}` do servidor real.
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

/**
 * Formato de `types.MessageInfo` do `whatsmeow`, conforme o Swagger do
 * servidor — campos no nível raiz, diferente do `key.fromMe` aninhado da
 * Evolution API (Node) original.
 */
type MensagemDoEvolutionGo = {
  id?: string
  chat?: string
  isFromMe?: boolean
  isGroup?: boolean
  pushName?: string
  /** O texto em si não está documentado no Swagger (é o corpo do evento
   * assíncrono, não uma resposta HTTP) — tentamos os formatos mais prováveis. */
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
    imageMessage?: { caption?: string }
    audioMessage?: unknown
    documentMessage?: { fileName?: string }
  }
  text?: string
}

type PayloadDoEvolutionGo = {
  event?: string
  type?: string
  data?: MensagemDoEvolutionGo | MensagemDoEvolutionGo[] | { connected?: boolean; state?: string }
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
function textoDaMensagem(mensagem: MensagemDoEvolutionGo): string {
  if (mensagem.text) return mensagem.text

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
function telefoneDoRemetente(chat: string | undefined, isGroup: boolean | undefined): string | null {
  if (!chat) return null
  if (isGroup) return null
  return chat.split('@')[0] || null
}

export async function POST(
  requisicao: Request,
  { params }: { params: Promise<{ workspaceId: string; segredo: string }> },
) {
  const { workspaceId, segredo } = await params
  const admin = createAdminClient()

  // A conexão confirma que esta empresa tem WhatsApp conectado, e guarda o
  // segredo que autentica a chamada.
  const { data: conexao } = await admin
    .from('integration_connections')
    .select('workspace_id')
    .eq('provider', 'whatsapp')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  // 404 e não 401: confirmar que a instância existe já entregaria informação a
  // quem está tentando adivinhar.
  if (!conexao || !segredoConfere(segredo, process.env.EVOLUTION_WEBHOOK_SECRET)) {
    return new NextResponse('Não encontrado.', { status: 404 })
  }

  let payload: PayloadDoEvolutionGo
  try {
    payload = (await requisicao.json()) as PayloadDoEvolutionGo
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 })
  }

  // `MESSAGE` e `CONNECTION` são os nomes da ASSINATURA (o que pedimos em
  // `/instance/connect`), não os nomes dos eventos que chegam. Confirmado no
  // log do servidor em 22/08: `subscriptions [MESSAGE CONNECTION] eventType
  // QRCode` — e o webhook respondia `{"ok":true,"ignorado":"LoggedOut"}`,
  // porque procurava por `CONNECTION` e recebia `LoggedOut`.
  //
  // Os nomes reais vêm dos tipos de evento do `whatsmeow`, a biblioteca que
  // o Evolution GO usa por baixo.
  const evento = payload.event ?? payload.type

  /** Conectou de verdade: o número está pareado e a sessão está de pé. */
  const CONECTOU = ['Connected', 'PairSuccess']
  /** Caiu: sessão encerrada, número desvinculado, ou queda de rede. */
  const DESCONECTOU = ['LoggedOut', 'Disconnected', 'StreamReplaced']
  /** Mensagem recebida. */
  const MENSAGEM = ['Message']

  // Ruído do ciclo de pareamento: o servidor gera um QR novo a cada 20s e
  // avisa por webhook. Não é informação para o CRM (a tela já busca o QR
  // ativamente enquanto o diálogo está aberto) e não deve virar log.
  if (evento === 'QRCode' || evento === 'QRTimeout') {
    return NextResponse.json({ ok: true, ignorado: evento })
  }

  if (evento && CONECTOU.includes(evento)) {
    await admin
      .from('integration_connections')
      .update({ status: 'connected', last_error: null })
      .eq('provider', 'whatsapp')
      .eq('workspace_id', workspaceId)

    return NextResponse.json({ ok: true })
  }

  // O número caiu. Marcar como erro é o que faz a tela avisar em vez de deixar
  // a pessoa achando que está tudo certo — numa API não oficial, queda é o
  // evento que não pode passar despercebido.
  //
  // `LoggedOut` também chega durante o pareamento normal (antes de haver
  // número vinculado, o whatsmeow considera a sessão deslogada), então só
  // marca erro se a conexão JÁ estava conectada — senão toda tentativa de
  // conectar terminaria com a tela dizendo que caiu.
  if (evento && DESCONECTOU.includes(evento)) {
    const { data: conexaoAtual } = await admin
      .from('integration_connections')
      .select('status')
      .eq('provider', 'whatsapp')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (conexaoAtual?.status === 'connected') {
      await admin
        .from('integration_connections')
        .update({ status: 'error', last_error: 'O WhatsApp desconectou.' })
        .eq('provider', 'whatsapp')
        .eq('workspace_id', workspaceId)
    }

    return NextResponse.json({ ok: true })
  }

  if (!evento || !MENSAGEM.includes(evento)) {
    // Evento que não tratamos. Responder 200 evita que o Evolution fique
    // reenviando algo que nunca vamos processar.
    return NextResponse.json({ ok: true, ignorado: evento })
  }

  const mensagens = Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data as MensagemDoEvolutionGo]
      : []

  for (const mensagem of mensagens) {
    const eventId = mensagem.id
    if (!eventId) continue

    // Mensagem que NÓS enviamos volta como evento também. Registrar viraria
    // eco: a atividade já foi criada no momento do envio.
    if (mensagem.isFromMe) continue

    const telefone = telefoneDoRemetente(mensagem.chat, mensagem.isGroup)
    if (!telefone) continue

    // Dedupe antes de qualquer escrita: o Evolution reenvia em caso de falha
    // de rede, e sem isso a timeline encheria de duplicata. `23505` é
    // unique_violation — evento repetido, não é erro.
    const { error: erroDedupe } = await admin
      .from('whatsapp_webhook_events')
      .insert({ event_id: `${workspaceId}:${eventId}` })

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
      p_workspace_id: workspaceId,
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
          workspace_id: workspaceId,
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
      workspace_id: workspaceId,
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
      .eq('workspace_id', workspaceId)
      .eq('lead_id', lead)
      .is('done_at', null)
      .limit(1)
      .maybeSingle()

    if (!tarefaAberta) {
      await admin.from('tasks').insert({
        workspace_id: workspaceId,
        lead_id: lead,
        title: 'Responder no WhatsApp',
        type: 'nota',
        due_at: new Date(Date.now() + PRAZO_DE_RESPOSTA_HORAS * 60 * 60 * 1000).toISOString(),
      })
    }
  }

  return NextResponse.json({ ok: true })
}
