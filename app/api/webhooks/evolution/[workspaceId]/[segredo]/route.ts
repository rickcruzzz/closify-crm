import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { appUrl } from '@/lib/app-url'
import { conectarInstancia, obterEstado } from '@/lib/integrations/evolution/api'
import { obterTokenDaInstancia } from '@/lib/integrations/evolution/token'
import { renderWhatsappDesconectadoEmail } from '@/lib/emails/whatsapp-desconectado'
import { getResend } from '@/lib/resend/client'
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
 * único jeito de saber que o POST veio do nosso servidor é um segredo
 * embutido na própria URL do webhook, comparado com `timingSafeEqual` — mesmo
 * padrão de `lib/integrations/state.ts`.
 *
 * A URL vira credencial, então ela nunca aparece em tela nem em log.
 *
 * **O segredo é ÚNICO para todas as empresas** (`EVOLUTION_WEBHOOK_SECRET`),
 * não um por conexão — o comentário anterior aqui dizia o contrário e estava
 * errado. A consequência precisa ser dita: quem conhecer o segredo consegue
 * injetar mensagem falsa no funil de QUALQUER empresa, bastando saber o UUID
 * dela. Não dá para LER nada de ninguém (a rota só escreve), e o segredo hoje
 * só existe no `.env` e na configuração das instâncias no servidor Evolution,
 * a que apenas o dono da plataforma tem acesso.
 *
 * É fraqueza de arquitetura, não buraco explorável hoje. O caminho correto
 * quando houver muitos clientes é um segredo por conexão, gerado na hora de
 * conectar e guardado junto do token — o que também limita o estrago se um
 * único cliente for comprometido. Registrado em `docs/estado-atual.md`.
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
 * Teto de mensagens processadas por chamada.
 *
 * O laço abaixo é SÉRIE, e cada mensagem custa 4 a 6 idas ao banco (dedupe,
 * casar telefone, criar contato, atividade, buscar tarefa, criar tarefa). A
 * ~80ms por ida, são ~400ms por mensagem — em `maxDuration = 15` cabem cerca
 * de 30 com folga.
 *
 * O perigo não é a lentidão, é o CORTE: a função morre no meio do lote, e
 * toda mensagem que já gravou dedupe e ainda não virou atividade some para
 * sempre, porque o reenvio do Evolution bate no dedupe e é recusado.
 *
 * Com o teto, o excedente nunca chega a gravar dedupe — então continua
 * elegível para reenvio, que é o comportamento correto: melhor processar
 * depois do que perder.
 */
const MAXIMO_DE_MENSAGENS_POR_CHAMADA = 25

/**
 * Guarda a mensagem que não completou o caminho até o funil.
 *
 * ## Por que toda falha passa por aqui
 *
 * O dedupe é gravado ANTES do processamento, de propósito: sem isso, o
 * reenvio do Evolution duplicaria a atividade. Mas isso cria uma janela onde
 * a mensagem já é considerada "vista" e ainda não virou nada — e qualquer
 * falha dentro dessa janela a apaga da existência, sem erro em lugar nenhum.
 *
 * O caminho do limite de plano já tratava disso. Os outros não: `activities`
 * e `tasks` eram inseridos sem checar erro, e uma falha de RLS, constraint ou
 * rede descartava a mensagem em silêncio. Num produto que promete não perder
 * venda, perdê-la pelo próprio silêncio é a falha mais cara possível.
 *
 * `error_logs` guarda telefone E texto porque um sem o outro não permite
 * decidir se aquele contato valia a venda.
 */
async function registrarMensagemPerdida(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  telefone: string,
  texto: string,
  motivo: string,
): Promise<void> {
  try {
    await admin.from('error_logs').insert({
      message: `WhatsApp: mensagem recebida mas não registrada (${motivo}) de ${telefone}: ${texto}`,
      origem: 'whatsapp',
      url: `/api/webhooks/evolution/${workspaceId}`,
      workspace_id: workspaceId,
    })
  } catch (err) {
    // Último recurso. Se nem o registro do erro funciona, insistir só troca
    // uma mensagem perdida por uma exceção que derruba o lote inteiro.
    console.error('Webhook Evolution: falhei até ao registrar a perda', err)
  }
}

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

/**
 * Tenta levantar de novo uma sessão que estava conectada e caiu.
 *
 * Devolve `true` só quando o servidor confirma `LoggedIn: true` depois da
 * tentativa — nunca assume sucesso pelo `/instance/connect` não ter
 * estourado, porque essa chamada responde 200 ao ACEITAR o pedido, não ao
 * terminar de conectar (mesma armadilha documentada em `obterQrCode`).
 *
 * Nunca deixa escapar exceção: uma falha aqui (Evolution fora do ar,
 * timeout) deve levar ao caminho de "marcar erro e avisar", não derrubar o
 * webhook com 500 e fazer o Evolution reenviar o mesmo evento de queda.
 */
async function tentarReconectarAutomaticamente(workspaceId: string): Promise<boolean> {
  try {
    const token = await obterTokenDaInstancia(workspaceId)
    if (!token) return false

    const segredo = process.env.EVOLUTION_WEBHOOK_SECRET
    const webhookUrl = segredo
      ? `${appUrl()}/api/webhooks/evolution/${encodeURIComponent(workspaceId)}/${segredo}`
      : ''
    const { jaConectado } = await conectarInstancia(token, webhookUrl)
    if (jaConectado) return true

    // `conectarInstancia` pode devolver um QR em vez de `jaConectado`, se o
    // Evolution decidiu que a sessão precisa de pareamento novo (ex.: o
    // armazenamento local da instância se perdeu). Um QR não confirma nada
    // sozinho — confere o estado de verdade antes de dizer que reconectou.
    const { estado } = await obterEstado(token)
    return estado === 'open'
  } catch (err) {
    console.error('Webhook Evolution: reconexão automática falhou', err)
    return false
  }
}

/**
 * Avisa quem criou a empresa que o WhatsApp caiu e a reconexão automática
 * não resolveu sozinha.
 *
 * Mesmo padrão de resolução de destinatário que `buscarAssinante`
 * (`lib/asaas/aplicar-evento.ts`) já usa para os e-mails de cobrança:
 * `workspaces.created_by` é quem recebe, porque é o único vínculo entre
 * workspace e conta de login que o schema garante (sem tabela própria de
 * "quem administra notificação").
 *
 * Engole qualquer falha de propósito — mesma razão de `aplicarEventoAsaas`:
 * o estado já foi gravado antes desta chamada, o e-mail é aviso, não é o
 * efeito. Deixar a exceção escapar faria o Evolution reenviar o evento de
 * queda pra sempre por causa de um problema no Resend, não na conexão.
 */
async function avisarQueoWhatsappCaiu(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
): Promise<void> {
  try {
    const { data: workspace } = await admin
      .from('workspaces')
      .select('name, created_by')
      .eq('id', workspaceId)
      .maybeSingle()
    if (!workspace?.created_by) return

    const { data: dono } = await admin.auth.admin.getUserById(workspace.created_by)
    const email = dono?.user?.email
    if (!email) return

    const { subject, html } = renderWhatsappDesconectadoEmail({
      workspaceName: workspace.name,
      appUrl: appUrl(),
    })

    const { error } = await getResend().emails.send({
      from: 'Velo Funil <suporte@velofunil.com.br>',
      to: email,
      subject,
      html,
    })
    if (error) console.error('Webhook Evolution: falha ao enviar aviso de queda', error)
  } catch (err) {
    console.error('Webhook Evolution: falha ao montar aviso de queda', err)
  }
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

  // ## O plano ainda dá direito ao recurso?
  //
  // Existir linha em `integration_connections` provava só que a empresa
  // conectou UM DIA — e conexão não expira sozinha quando o plano cai. Achado
  // em produção (24/08): a "Consultoria Aurora" estava em `pro_vigente()
  // false`, com a conexão `connected` e sendo atualizada no mesmo dia. Ou
  // seja, um recurso Pro rodando para quem não paga, sem erro em lugar nenhum.
  //
  // A checagem é `pro_vigente()`, nunca `workspaces.plan` — doutrina travada
  // desde a 0027, porque a coluna é o último valor gravado e não sabe que o
  // prazo venceu. Aqui isso importa em dobro: um trial que expirou deixa a
  // coluna dizendo o que era, não o que é.
  //
  // Responde 200, não erro: para o Evolution a entrega funcionou, e devolver
  // falha faria ele reenviar para sempre algo que vai ser recusado pelo mesmo
  // motivo. O estado da conexão vira `error` com aviso na tela, que é o que
  // leva a pessoa ao upgrade em vez de deixá-la achando que ainda funciona.
  const { data: temPro } = await admin.rpc('pro_vigente', {
    target_workspace_id: workspaceId,
  })

  if (!temPro) {
    await admin
      .from('integration_connections')
      .update({
        status: 'error',
        last_error:
          'O WhatsApp é um recurso do plano Pro. Sua conexão está pausada e as ' +
          'mensagens não estão entrando no funil. Reative o Pro para voltar a receber.',
      })
      .eq('workspace_id', workspaceId)
      .eq('provider', 'whatsapp')
      .neq('status', 'error')

    return NextResponse.json({ ok: true, ignorado: 'plano sem direito ao recurso' })
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
  // mexe em algo se a conexão JÁ estava conectada — senão toda tentativa de
  // conectar terminaria com a tela dizendo que caiu.
  if (evento && DESCONECTOU.includes(evento)) {
    const { data: conexaoAtual } = await admin
      .from('integration_connections')
      .select('status')
      .eq('provider', 'whatsapp')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (conexaoAtual?.status !== 'connected') {
      return NextResponse.json({ ok: true })
    }

    // `LoggedOut` é a pessoa desvinculando o aparelho pelo próprio celular —
    // tentar reconectar não resolveria, só um pareamento novo (QR/código)
    // resolve. `Disconnected`/`StreamReplaced` costumam ser queda de rede ou
    // o processo do Evolution reiniciando: nesses dois, o mesmo caminho que
    // `conectarWhatsapp` usa para reconectar manualmente (`/instance/connect`
    // reaproveitando o token já gravado) tende a levantar a sessão sozinho,
    // sem pedir QR novo — é o "caminho comum numa API não oficial" que
    // `lib/integrations/evolution/actions.ts` já documentava, só que
    // disparado automaticamente em vez de esperar alguém notar e clicar.
    const reconectouSozinho = evento !== 'LoggedOut' && (await tentarReconectarAutomaticamente(workspaceId))

    if (reconectouSozinho) {
      await admin
        .from('integration_connections')
        .update({ status: 'connected', last_error: null })
        .eq('provider', 'whatsapp')
        .eq('workspace_id', workspaceId)
      return NextResponse.json({ ok: true, reconectado: true })
    }

    await admin
      .from('integration_connections')
      .update({ status: 'error', last_error: 'O WhatsApp desconectou.' })
      .eq('provider', 'whatsapp')
      .eq('workspace_id', workspaceId)

    // Só chega aqui numa transição REAL de conectado -> caído (o `if` acima
    // já filtrou o resto), então isto dispara no máximo uma vez por queda —
    // a próxima notificação deste mesmo evento vai encontrar `status` já em
    // `error` e sair pelo `return` do topo, sem reenviar o aviso.
    await avisarQueoWhatsappCaiu(admin, workspaceId)

    return NextResponse.json({ ok: true, reconectado: false })
  }

  if (!evento || !MENSAGEM.includes(evento)) {
    // Evento que não tratamos. Responder 200 evita que o Evolution fique
    // reenviando algo que nunca vamos processar.
    return NextResponse.json({ ok: true, ignorado: evento })
  }

  const todasAsMensagens = Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data as MensagemDoEvolutionGo]
      : []

  // O excedente NÃO é descartado: como o dedupe só é gravado dentro do laço,
  // o que sobra continua elegível para reenvio pelo Evolution. Cortar aqui é
  // o que impede a função de morrer no meio do lote e apagar mensagem que já
  // tinha dedupe gravado.
  const mensagens = todasAsMensagens.slice(0, MAXIMO_DE_MENSAGENS_POR_CHAMADA)

  if (todasAsMensagens.length > MAXIMO_DE_MENSAGENS_POR_CHAMADA) {
    console.warn(
      `Webhook Evolution: lote de ${todasAsMensagens.length} mensagens, ` +
        `processando ${MAXIMO_DE_MENSAGENS_POR_CHAMADA}; o resto volta no reenvio`,
    )
  }

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
      // `23505` é unique_violation: evento repetido, o caminho normal do
      // reenvio. Não é erro e não vira registro.
      if (erroDedupe.code === '23505') continue

      // Qualquer outro motivo (banco indisponível, permissão) significa que a
      // mensagem chegou e não vai ser processada. Antes isso era só um
      // `console.error`, que ninguém lê em produção — a mensagem sumia sem
      // deixar rastro. Aqui o dedupe NÃO foi gravado, então o Evolution ainda
      // pode reenviar; o registro existe para o caso de o reenvio também
      // falhar.
      console.error('Webhook Evolution: falha ao gravar dedupe', erroDedupe)
      await registrarMensagemPerdida(
        admin,
        workspaceId,
        telefone,
        textoDaMensagem(mensagem),
        `dedupe ${erroDedupe.code ?? 'sem código'}`,
      )
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
      //
      // Mas `continue` sozinho DESCARTA A MENSAGEM EM SILÊNCIO, e isso é o
      // oposto exato do que este produto promete. Medido em 23/08 numa
      // simulação de carga: 86 mensagens de números desconhecidos criaram 86
      // contatos — três dias de WhatsApp movimentado estouram sozinhos o teto
      // de 300 do plano Free, sem o cliente cadastrar ninguém. A partir daí,
      // toda mensagem de número novo cairia aqui e sumiria: o cliente escreve
      // "quero comprar", o dedupe impede o reenvio, e ninguém nunca fica
      // sabendo. Perder venda por esquecimento é o problema que o produto
      // existe para resolver; perdê-la por silêncio do próprio produto é pior.
      //
      // Então a mensagem não é salva no funil, mas TAMBÉM não é perdida:
      // fica em `error_logs` com telefone e texto (recuperável por consulta),
      // e o motivo sobe para a tela de Integrações via `last_error`.
      if (erroLead || !novo) {
        console.error('Webhook Evolution: não consegui criar o lead', erroLead)

        const limiteDoPlano = erroLead?.code === '42501'
        const aviso = limiteDoPlano
          ? 'Seu plano chegou ao limite de contatos. Mensagens de números novos ' +
            'não estão entrando no funil, só as de quem já é seu contato. ' +
            'Faça upgrade para voltar a receber tudo.'
          : 'Não consegui registrar a mensagem de um número novo. ' +
            'As mensagens de quem já é seu contato continuam entrando.'

        await Promise.all([
          // O texto vai junto porque um telefone sem a mensagem não permite
          // decidir se aquele contato valia a venda.
          admin.from('error_logs').insert({
            message: `WhatsApp: mensagem não registrada (${erroLead?.code ?? 'sem código'}) ` +
              `de ${telefone}: ${textoDaMensagem(mensagem)}`,
            origem: 'whatsapp',
            url: `/api/webhooks/evolution/${workspaceId}`,
            workspace_id: workspaceId,
          }),
          admin
            .from('integration_connections')
            .update({ last_error: aviso })
            .eq('workspace_id', workspaceId)
            .eq('provider', 'whatsapp'),
        ])

        continue
      }

      lead = novo.id

      // Criar contato novo voltou a funcionar: apaga o aviso de limite, senão
      // ele fica preso na tela para sempre depois do upgrade. Só roda quando um
      // contato NOVO nasce — que é exatamente o caso que falhava — então não
      // custa uma escrita por mensagem recebida.
      await admin
        .from('integration_connections')
        .update({ last_error: null })
        .eq('workspace_id', workspaceId)
        .eq('provider', 'whatsapp')
        .not('last_error', 'is', null)
    }

    // O erro É verificado: o dedupe já foi gravado acima, então uma falha aqui
    // apaga a mensagem da existência — o Evolution não reenvia o que já
    // deduplicou. Era o buraco mais caro que sobrava neste arquivo.
    const { error: erroAtividade } = await admin.from('activities').insert({
      workspace_id: workspaceId,
      lead_id: lead,
      type: 'nota',
      description: `WhatsApp: ${textoDaMensagem(mensagem)}`,
      integration_provider: 'whatsapp',
    })

    if (erroAtividade) {
      console.error('Webhook Evolution: não consegui gravar a atividade', erroAtividade)
      await registrarMensagemPerdida(
        admin,
        workspaceId,
        telefone,
        textoDaMensagem(mensagem),
        `activities ${erroAtividade.code ?? 'sem código'}`,
      )
      continue
    }

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
      const { error: erroTarefa } = await admin.from('tasks').insert({
        workspace_id: workspaceId,
        lead_id: lead,
        title: 'Responder no WhatsApp',
        type: 'nota',
        due_at: new Date(Date.now() + PRAZO_DE_RESPOSTA_HORAS * 60 * 60 * 1000).toISOString(),
      })

      // Diferente dos outros: a mensagem JÁ virou atividade, então o histórico
      // está salvo e nada se perdeu. O que falhou foi o lembrete — some o
      // empurrão para responder, não o registro. Fica no log para investigar
      // sem alarmar o cliente com um aviso na tela.
      if (erroTarefa) {
        console.error('Webhook Evolution: atividade salva, tarefa não', erroTarefa)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
