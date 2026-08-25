import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { appUrl } from '@/lib/app-url'
import { renderWhatsappDesconectadoEmail } from '@/lib/emails/whatsapp-desconectado'
import { getResend } from '@/lib/resend/client'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  avisoDeFluxoParado,
  conexoesQueParaamDeReceber,
  type ConexaoObservada,
} from '@/lib/integrations/evolution/saude-do-fluxo'

/**
 * Vigia o FLUXO do WhatsApp, não o estado da conexão.
 *
 * ## O buraco que isto fecha, aberto duas vezes em 25/08
 *
 * O processo do Evolution vira zumbi: a camada HTTP responde, `/send/text`
 * funciona, `/instance/status` devolve `connected` — e o laço de eventos está
 * morto. Nenhuma mensagem entra, e **nada no sistema sabia**.
 *
 * Na primeira vez custou uma madrugada. Na segunda, três horas se passaram
 * antes de alguém reparar, e só porque o dono foi olhar. Com cliente pagante do
 * outro lado, três horas de silêncio é exatamente a venda que este produto
 * existe para não perder.
 *
 * ## Por que o fluxo, e não o status
 *
 * `integration_connections.status` guarda o último estado GRAVADO, e o zumbi
 * não grava nada — ele fica `connected` para sempre. O webhook de queda também
 * não ajuda: no zumbi o Evolution não emite evento nenhum, nem de desconexão.
 *
 * Quem sabe a verdade é `whatsapp_webhook_events`. Se chegou evento, o laço
 * está vivo; se parou de chegar em quem recebia, alguma coisa quebrou entre a
 * Meta e o nosso banco — e o motivo exato importa menos que o aviso.
 *
 * ## Por que 200 mesmo quando encontra problema
 *
 * O Vercel Cron trata resposta de erro como falha do job e tenta de novo. Achar
 * uma conexão parada não é falha DESTE código: é o trabalho dele funcionando.
 * O que sobe para o log é o resumo, e o cliente recebe o e-mail.
 */
export const runtime = 'nodejs'

/**
 * Teto explícito. São duas buscas e um e-mail por conexão parada; passar de 60s
 * significa que algo está errado (banco lento, Resend fora), e falhar rápido
 * expõe isso em vez de esconder.
 */
export const maxDuration = 60

/** Mesma razão do teto em `lib/dono/queries.ts`: o PostgREST corta em 1.000. */
const TETO = 5000

function segredoValido(cabecalho: string | null): boolean {
  const esperado = process.env.CRON_SECRET
  if (!cabecalho || !esperado) return false

  const prefixo = 'Bearer '
  if (!cabecalho.startsWith(prefixo)) return false

  const a = Buffer.from(cabecalho.slice(prefixo.length))
  const b = Buffer.from(esperado)
  // `timingSafeEqual` estoura se os tamanhos diferem, e o tamanho já vaza
  // informação — comparar antes evita as duas coisas.
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

/**
 * Avisa o dono da empresa por e-mail.
 *
 * Reusa o e-mail de desconexão, que já está escrito e testado: para quem lê, a
 * diferença entre "caiu" e "está conectado mas não recebe" não muda o que
 * fazer — reconectar resolve os dois. Criar um segundo e-mail seria uma segunda
 * verdade sobre a mesma instrução.
 *
 * Falha de envio não derruba a varredura: o estado já foi gravado, e a tela vai
 * mostrar o aviso mesmo que o e-mail não saia.
 */
async function avisarDono(
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
    if (error) console.error('Vigia do WhatsApp: falha ao enviar aviso', error)
  } catch (err) {
    console.error('Vigia do WhatsApp: falha ao montar aviso', err)
  }
}

export async function GET(requisicao: Request) {
  if (!segredoValido(requisicao.headers.get('authorization'))) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: conexoes, error: erroConexoes } = await admin
    .from('integration_connections')
    .select('workspace_id, status')
    .eq('provider', 'whatsapp')
    .limit(TETO)

  if (erroConexoes) {
    console.error('Vigia do WhatsApp: falha ao ler conexões', erroConexoes)
    return NextResponse.json({ erro: 'Falha ao ler conexões.' }, { status: 500 })
  }

  const ativas = (conexoes ?? []).filter((c) => c.status === 'connected')
  if (ativas.length === 0) {
    return NextResponse.json({ ok: true, conectadas: 0, paradas: 0 })
  }

  // Uma busca por conexão, com `order + limit(1)`: o banco devolve UMA linha,
  // e não a coleção inteira para o JavaScript achar o máximo — que é como esta
  // consulta herdaria o corte silencioso de 1.000 linhas do PostgREST numa
  // empresa movimentada.
  const observadas: ConexaoObservada[] = await Promise.all(
    ativas.map(async (conexao) => {
      const { data } = await admin
        .from('whatsapp_webhook_events')
        .select('processed_at')
        .like('event_id', `${conexao.workspace_id}:%`)
        .order('processed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return {
        workspaceId: conexao.workspace_id,
        status: conexao.status,
        ultimoEvento: data?.processed_at ?? null,
      }
    }),
  )

  const paradas = conexoesQueParaamDeReceber(observadas)

  for (const parada of paradas) {
    const { error } = await admin
      .from('integration_connections')
      .update({
        status: 'error',
        last_error: avisoDeFluxoParado(parada.horasEmSilencio),
      })
      .eq('workspace_id', parada.workspaceId)
      .eq('provider', 'whatsapp')
      // `connected` na condição, e não só no filtro de cima: entre a leitura e
      // esta escrita a conexão pode ter mudado sozinha, e sobrescrever um
      // estado novo com um diagnóstico velho é pior que não avisar.
      .eq('status', 'connected')

    if (error) {
      console.error('Vigia do WhatsApp: falha ao marcar conexão parada', error)
      continue
    }

    await avisarDono(admin, parada.workspaceId)
  }

  if (paradas.length > 0) {
    console.warn(
      `Vigia do WhatsApp: ${paradas.length} conexão(ões) conectada(s) e sem receber`,
      paradas,
    )
  }

  return NextResponse.json({
    ok: true,
    conectadas: ativas.length,
    paradas: paradas.length,
  })
}
