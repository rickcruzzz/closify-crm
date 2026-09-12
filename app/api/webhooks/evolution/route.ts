import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { avisarNoWhatsapp } from '@/lib/dono/aviso-whatsapp-envio'
import {
  deveRegistrar,
  normalizarMensagem,
  type MensagemRecebida,
} from '@/lib/prospeccao/mensagem-recebida'
import { EMPRESAS_DE_PROSPECCAO, EMPRESA_DA_PROSPECCAO } from '@/lib/prospeccao/empresas'
import { pediuParaSair, ultimos8 } from '@/lib/prospeccao/opt-out'
import { registrarDescadastro } from '@/lib/prospeccao/opt-out-queries'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * A resposta do prospect entra no sistema. FASE 1: captura, e só captura.
 *
 * ## O buraco que esta rota fecha
 *
 * A auditoria de 12/09 mediu que a máquina de vendas quebra entre os passos 8
 * e 9: a mensagem sai, a resposta chega **no celular do dono**, e nada no
 * sistema escuta. Sem registro de resposta, nenhuma etapa seguinte pode ser
 * medida — nem taxa de resposta, nem qual gancho funciona, nem se o score
 * prevê alguma coisa. O aprendizado não tem contra o que aprender.
 *
 * ## O que ela NÃO faz, e isso é decisão
 *
 * **Não responde ninguém.** O agente SDR existe em `app/api/sdr/responder` e
 * continua desligado. Ligar a IA antes de existir uma amostra de respostas
 * seria dar inteligência a um sistema que ainda não enxerga nada — e a ordem
 * pedida é capture, meça, compare, só então otimize.
 *
 * Não classifica intenção, não trata objeção, não conduz para checkout. Cada
 * uma dessas colunas nasce junto do código que a lê, e não antes: `utm_content`
 * (0069), `gclid` (0071) e `utm_campaign` foram criadas, capturadas, gravadas
 * e nunca lidas — três relatórios com aparência de medição e conteúdo vazio.
 *
 * ## Por que reabrir um webhook que foi FECHADO de propósito
 *
 * `c52a718` (28/08) removeu `/api/webhooks/evolution/[workspaceId]/[segredo]`
 * com um motivo que continua válido, palavra por palavra do commit:
 *
 * > o `EVOLUTION_WEBHOOK_SECRET` é único para todas as empresas, então quem o
 * > conhecesse injetaria mensagem falsa no funil de qualquer uma sabendo o
 * > UUID dela
 *
 * **Esta rota não reabre isso, e a diferença é estrutural: prospecção não é
 * multiempresa.** A empresa de destino é resolvida no SERVIDOR, pelo nome, e
 * nunca lida da requisição. Não existe UUID no payload — não existe o que
 * forjar. O pior que alguém com o segredo consegue é gravar uma conversa falsa
 * na fila de prospecção do próprio dono.
 *
 * `FASE_DO_WHATSAPP` continua `'migrando'` e o produto do cliente continua sem
 * WhatsApp. Esta rota é da prospecção, não do produto.
 *
 * ## O segredo vai no CABEÇALHO, e isso foi medido
 *
 * A rota antiga carregava o segredo na URL, que a Vercel registra em log. A
 * Evolution 2.3.7 aceita cabeçalho no webhook — conferido em 12/09 lendo
 * `GET /webhook/find/VELO`, que devolve o campo `headers`. Não é suposição
 * sobre a documentação: é o que a instalação respondeu.
 *
 * ## Rápido, e sem nunca devolver 500 por evento que não interessa
 *
 * O Asaas já ensinou o que custa devolver erro para o que não se entende: a
 * fila penaliza a entrega e **interrompe**, e fila parada é indistinguível de
 * "ninguém respondeu". Aqui, evento desconhecido responde 200 e segue.
 */

export const runtime = 'nodejs'

/**
 * Teto de execução.
 *
 * Quinze segundos, o mesmo da rota removida. É folgado para o que esta faz
 * (quatro idas ao banco e um aviso com timeout de 10s) e é o que impede a
 * gravação de ficar pendurada quando a VPS da Evolution engasga no aviso.
 */
export const maxDuration = 15

/** Só mensagem recebida interessa. Presença, status e conexão não. */
const EVENTOS = new Set(['messages.upsert', 'MESSAGES_UPSERT'])

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.EVOLUTION_WEBHOOK_SECRET
  if (!recebido || !esperado) return false

  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  // `timingSafeEqual` exige o mesmo tamanho. Comparar o tamanho antes não vaza
  // mais do que o próprio segredo já expõe, e evita a exceção.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Já vimos este evento?
 *
 * Primeira das DUAS camadas de dedupe. A segunda é o índice único
 * `mensagens (workspace_id, external_id)` da 0056 — e as duas existem porque
 * respondem a coisas diferentes: esta barra o reenvio antes de qualquer
 * trabalho, aquela impede a linha duplicada mesmo se esta falhar.
 *
 * `insert` e não `select`-depois-`insert`: a corrida entre os dois deixaria
 * passar o reenvio que chega no mesmo instante, que é exatamente o caso.
 */
async function eventoNovo(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<boolean> {
  const { error } = await supabase.from('whatsapp_webhook_events').insert({ event_id: eventId })
  // 23505 é chave duplicada: já processamos. Qualquer outro erro é problema de
  // verdade e não pode ser lido como "repetido".
  if (error && error.code === '23505') return false
  if (error) throw error
  return true
}

/** O aviso que chega no WhatsApp do dono. Curto: ele é lido no celular. */
function textoDoAviso(m: MensagemRecebida, empresa: string | null, saiu: boolean): string {
  const quem = empresa ?? m.nome ?? `+${m.telefone}`
  const corpo = m.texto.length > 300 ? `${m.texto.slice(0, 300)}…` : m.texto

  if (saiu) {
    return [
      `🚫 ${quem} pediu para SAIR`,
      `+${m.telefone}`,
      '',
      corpo,
      '',
      'Já registrei. Não entra mais em rodada nenhuma, e ninguém respondeu.',
    ].join('\n')
  }

  return [`💬 ${quem} respondeu`, `+${m.telefone}`, '', corpo].join('\n')
}

export async function POST(request: Request) {
  if (!process.env.EVOLUTION_WEBHOOK_SECRET) {
    // Falha FECHADA. Sem segredo configurado a rota não atende ninguém — o
    // contrário deixaria um endereço de escrita aberto enquanto alguém "ainda
    // não configurou". Mesmo desenho de `/api/sdr/responder`.
    return NextResponse.json({ error: 'webhook não configurado' }, { status: 503 })
  }

  // `authorization` e não um cabeçalho próprio: é o que qualquer proxy no
  // caminho já sabe não registrar em log.
  const cabecalho = request.headers.get('authorization') ?? request.headers.get('x-velo-segredo')
  const recebido = cabecalho?.replace(/^Bearer\s+/i, '') ?? null
  if (!segredoConfere(recebido)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  let corpo: { event?: string; data?: unknown }
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })
  }

  const evento = typeof corpo.event === 'string' ? corpo.event : ''
  if (!EVENTOS.has(evento)) {
    return NextResponse.json({ ok: true, ignorado: 'evento' })
  }

  const mensagem = normalizarMensagem(corpo.data)
  if (!deveRegistrar(mensagem)) {
    // Nossa própria abordagem voltando como evento, mensagem de grupo, ou algo
    // que não é mensagem. Nenhum dos três é erro.
    return NextResponse.json({ ok: true, ignorado: 'mensagem' })
  }

  const supabase = createAdminClient()

  if (!(await eventoNovo(supabase, mensagem.id!))) {
    return NextResponse.json({ ok: true, ignorado: 'repetido' })
  }

  const telefone = mensagem.telefone!
  const oito = ultimos8(telefone)
  const saiu = pediuParaSair(mensagem.texto)

  // ## A empresa é resolvida PELO NOME, aqui, no servidor
  //
  // É a trava que separa esta rota da que foi removida em 28/08. Ver o
  // cabeçalho, e `lib/prospeccao/empresas.ts` para o porquê de a lista de
  // leitura ter duas empresas e a de escrita ter uma.
  const { data: empresas, error: erroDeEmpresa } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('name', EMPRESAS_DE_PROSPECCAO)
  if (erroDeEmpresa) throw erroDeEmpresa

  const paraGravar = (empresas ?? []).find((e) => e.name === EMPRESA_DA_PROSPECCAO)
  if (!paraGravar) {
    // Sem a empresa não há onde gravar a conversa. O evento já foi marcado
    // como visto, então isto não vira laço de reentrega — e o aviso ainda sai,
    // que é o que impede a resposta de se perder enquanto alguém conserta.
    await avisarNoWhatsapp(
      `⚠️ Resposta de +${telefone} NÃO foi gravada: a empresa "${EMPRESA_DA_PROSPECCAO}" não existe.\n\n${mensagem.texto.slice(0, 200)}`,
    )
    return NextResponse.json({ ok: true, gravado: false, motivo: 'empresa ausente' })
  }

  // ## O prospect, quando ele existe
  //
  // Pode não existir: os ~100 disparos anteriores a 12/09 marcaram estado só em
  // `.dono-prospeccao.json`, na máquina do dono. A resposta é registrada do
  // mesmo jeito — perder a conversa porque falta a atribuição seria trocar o
  // dado importante pelo acessório.
  const { data: prospect } = oito
    ? await supabase
        .from('prospeccao_prospect')
        .select('id, dominio, nome')
        .eq('telefone_ultimos8', oito)
        .limit(1)
        .maybeSingle()
    : { data: null }

  // ## O opt-out é gravado ANTES da conversa
  //
  // A ordem importa: se a gravação da mensagem falhar por qualquer motivo, o
  // pedido de saída já está registrado. O contrário — registrar a conversa e
  // perder o opt-out — manda a segunda abordagem para quem disse não, que é o
  // primeiro item da lista do que derruba um número.
  if (saiu) {
    await registrarDescadastro({
      telefone,
      dominio: prospect?.dominio ?? null,
      origem: 'resposta',
    })
  }

  // O contato: procurado nas duas empresas, criado só na de escrita.
  let leadId: string | null = null
  for (const empresa of empresas ?? []) {
    const { data: achado } = await supabase.rpc('encontrar_lead_por_telefone', {
      p_workspace_id: empresa.id,
      p_telefone: telefone,
    })
    if (achado) {
      leadId = achado
      break
    }
  }

  let workspaceId = paraGravar.id
  if (leadId) {
    // O lead pode estar na empresa antiga (`Orne`). A conversa tem que nascer
    // na MESMA empresa do lead: `conversas.lead_id` e `conversas.workspace_id`
    // são duas FKs independentes, e a RLS olha `workspace_id` da linha — a
    // classe de defeito que a 0038 e a 0077 já pagaram duas vezes.
    const { data: dono } = await supabase
      .from('leads')
      .select('workspace_id')
      .eq('id', leadId)
      .maybeSingle()
    if (dono?.workspace_id) workspaceId = dono.workspace_id
  } else {
    const { data: criado, error: erroDeLead } = await supabase
      .from('leads')
      .insert({
        workspace_id: paraGravar.id,
        name: (prospect?.nome ?? mensagem.nome ?? `+${telefone}`).slice(0, 120),
        // `company` guarda o domínio nas rodadas de prospecção, como em
        // `confirmarEnvio`. Sem prospect conhecido fica nulo, e a linha
        // continua sendo um contato válido.
        company: prospect?.dominio ?? null,
        // Nulo, e o contato continua válido: a 0025 exige e-mail OU telefone,
        // e quem chega por aqui chegou pelo telefone. Exigir os dois faria a
        // resposta de um prospect sem e-mail ser descartada.
        email: null,
        phone: telefone,
        status: 'novo',
      })
      .select('id')
      .single()
    // 23505 é a dedupe por telefone da 0025 funcionando: outro lead já tem
    // este número. Nesse caso a busca acima deveria tê-lo achado — se não
    // achou, o formato do telefone difere o bastante para os 8 dígitos não
    // casarem, e não há o que fazer aqui além de não derrubar a captura.
    if (erroDeLead && erroDeLead.code !== '23505') throw erroDeLead
    leadId = criado?.id ?? null
  }

  let conversaId: string | null = null
  let gravou = false

  if (leadId) {
    const agora = new Date().toISOString()

    // `unique (workspace_id, lead_id, canal)` da 0056 é o que permite o upsert
    // sem ler antes.
    const { data: conversa, error: erroDeConversa } = await supabase
      .from('conversas')
      .upsert(
        {
          workspace_id: workspaceId,
          lead_id: leadId,
          canal: 'whatsapp',
          ultimo_recebido_em: agora,
          // `null` quer dizer ESPERANDO RESPOSTA, e é o que ordena a tela de
          // Conversas. Toda mensagem recebida reabre a espera.
          respondida_em: null,
        },
        { onConflict: 'workspace_id,lead_id,canal' },
      )
      .select('id')
      .single()
    if (erroDeConversa) throw erroDeConversa
    conversaId = conversa?.id ?? null

    if (conversaId) {
      const { error: erroDeMensagem } = await supabase.from('mensagens').insert({
        workspace_id: workspaceId,
        conversa_id: conversaId,
        direcao: 'recebida',
        tipo: mensagem.tipo,
        // A mensagem CRUA, antes de qualquer interpretação. Nenhuma camada
        // derivada pode substituí-la.
        texto: mensagem.texto,
        midia_chave: mensagem.midiaChave,
        midia_mime: mensagem.midiaMime,
        midia_segundos: mensagem.midiaSegundos,
        external_id: mensagem.id,
        status: 'enviada',
      })
      // A segunda camada de dedupe. 23505 aqui quer dizer que a mensagem já
      // estava gravada, e isso é sucesso, não falha.
      if (erroDeMensagem && erroDeMensagem.code !== '23505') throw erroDeMensagem
      gravou = true
    }
  }

  if (prospect) {
    await supabase
      .from('prospeccao_prospect')
      .update({
        respondido_em: new Date().toISOString(),
        estagio: saiu ? 'OPTED_OUT' : 'REPLIED',
        lead_id: leadId,
        workspace_id: workspaceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prospect.id)
  }

  // ## O aviso é a última coisa, e falhar aqui NÃO derruba a captura
  //
  // "NADA PODE PASSAR BATIDO" é a ordem, e a forma de cumpri-la é avisar. Mas
  // a Evolution mora numa VPS que já saiu do ar: lançar por causa dela faria a
  // Evolution reentregar um evento cuja mensagem JÁ está no banco, e a única
  // consequência seria ruído.
  const aviso = await avisarNoWhatsapp(
    textoDoAviso(mensagem, prospect?.dominio ?? null, saiu),
  )
  if (!aviso.enviado) {
    console.error(`evolution: resposta de +${telefone} gravada, aviso falhou: ${aviso.erro}`)
  }

  return NextResponse.json({
    ok: true,
    gravado: gravou,
    optOut: saiu,
    prospect: prospect?.dominio ?? null,
    avisado: aviso.enviado,
  })
}
