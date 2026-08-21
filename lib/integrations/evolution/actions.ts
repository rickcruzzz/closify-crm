'use server'

import { revalidatePath } from 'next/cache'

import { appUrl } from '@/lib/app-url'
import { mensagemBloqueioPro } from '@/lib/integrations/mensagem-bloqueio-pro'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { configurarWebhook, criarInstancia, obterEstado, obterQrCode } from './api'

/**
 * Conectar e desconectar o WhatsApp de uma empresa.
 *
 * ## Uma instância por empresa, nunca compartilhada
 *
 * O `unique(workspace_id, provider)` de `integration_connections` (migration
 * 0034) já garante isso no banco, e é o que isola o risco: um número
 * restringido pela Meta afeta **um** cliente, não a base inteira. Número
 * compartilhado entre empresas seria um ponto único de falha com consequência
 * proporcional ao número de clientes.
 */
export type ResultadoDaConexao =
  { ok: true; qrCode: string | null } | { ok: false; erro: string }
/** Só admin mexe em integração — mesma regra do Google Calendar e do Gmail. */
async function exigirAdmin(workspaceId: string): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sessão expirada.')
  const { data: membro } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membro?.role !== 'admin') {
    throw new Error('Só quem administra a empresa pode conectar o WhatsApp.')
  }
  return user.id
}
/**
 * Cria a instância no Evolution e devolve o QR Code para leitura.
 *
 * O QR expira em ~20 segundos e o Evolution gera outro sozinho, então ele
 * **nunca é gravado** — a tela busca ao vivo enquanto o diálogo está aberto.
 * Persistir um QR seria persistir algo que já nasce vencido.
 */
export async function conectarWhatsapp(workspaceId: string): Promise<ResultadoDaConexao> {
  try {
    const userId = await exigirAdmin(workspaceId)
    // Integração é recurso Pro, igual a Calendar e Gmail. A regra real está na
    // policy de `integration_connections` (migration 0037); a checagem aqui
    // existe para dar mensagem clara em vez de erro de permissão cru.
    //
    // Lê `pro_vigente()`, nunca a coluna `workspaces.plan`: a coluna é o último
    // valor gravado e não sabe que o tempo passou — doutrina travada do
    // projeto desde o bug da migration 0028.
    const supabase = await createClient()
    const { data: podeUsar } = await supabase.rpc('pro_vigente', {
      target_workspace_id: workspaceId,
    })
    if (!podeUsar) {
      return { ok: false, erro: await mensagemBloqueioPro(supabase, workspaceId) }
    }
    // O nome da instância no Evolution é o id da empresa: é único por
    // construção, e faz o webhook saber de quem é a mensagem sem consulta
    // extra.
    const instancia = `velofunil-${workspaceId}`
    const { qrCode } = await criarInstancia(instancia)
    // O Evolution não assina o payload do webhook, então a URL carrega um
    // segredo que autentica a chamada. Ver o cabeçalho da rota.
    const segredo = process.env.EVOLUTION_WEBHOOK_SECRET
    if (segredo) {
      await configurarWebhook(
        instancia,
        `${appUrl()}/api/webhooks/evolution/${encodeURIComponent(instancia)}/${segredo}`,
      )
    }
    // `upsert` e não `insert`: reconectar depois de uma queda é o caminho
    // comum numa API não oficial, e um insert cru estouraria na chave única.
    const admin = createAdminClient()
    await admin.from('integration_connections').upsert(
      {
        workspace_id: workspaceId,
        provider: 'whatsapp',
        status: 'disconnected',
        external_id: instancia,
        connected_by: userId,
        scopes: [],
      },
      { onConflict: 'workspace_id,provider' },
    )
    revalidatePath('/settings')
    return { ok: true, qrCode }
  } catch (err) {
    return {
      ok: false,
      erro:
        err instanceof Error
          ? err.message
          : 'Não consegui falar com o servidor do WhatsApp.',
    }
  }
}
/** Busca um QR novo enquanto o diálogo está aberto (o anterior expirou). */
export async function renovarQrCode(workspaceId: string): Promise<ResultadoDaConexao> {
  try {
    await exigirAdmin(workspaceId)
    const qrCode = await obterQrCode(`velofunil-${workspaceId}`)
    return { ok: true, qrCode }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui buscar o código.',
    }
  }
}
/**
 * Diz se o número já foi conectado.
 *
 * A tela chama isso em intervalo enquanto o QR está na frente da pessoa: é
 * assim que o diálogo fecha sozinho quando ela termina de escanear.
 */
export async function estadoDaConexao(
  workspaceId: string,
): Promise<{ conectado: boolean; numero: string | null }> {
  try {
    await exigirAdmin(workspaceId)
    const instancia = await obterEstado(`velofunil-${workspaceId}`)
    const conectado = instancia.estado === 'open'
    if (conectado) {
      const admin = createAdminClient()
      await admin
        .from('integration_connections')
        .update({
          status: 'connected',
          account_label: instancia.numero,
          last_error: null,
        })
        .eq('workspace_id', workspaceId)
        .eq('provider', 'whatsapp')
      revalidatePath('/settings')
    }
    return { conectado, numero: instancia.numero }
  } catch {
    // Falhar aqui é normal enquanto a instância ainda está subindo — a tela
    // continua tentando em vez de mostrar erro no meio da leitura do QR.
    return { conectado: false, numero: null }
  }
}
