'use server'

import { randomBytes } from 'node:crypto'

import { revalidatePath } from 'next/cache'

import { appUrl } from '@/lib/app-url'
import { mensagemBloqueioPro } from '@/lib/integrations/mensagem-bloqueio-pro'
import { cifrar, decifrar } from '@/lib/integrations/crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import {
  conectarInstancia,
  criarInstancia,
  obterEstado,
  obterQrCode,
  ultimoErroDaInstancia,
} from './api'

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
 *
 * ## O token da instância, cifrado como um token OAuth qualquer
 *
 * O Evolution GO (ver `./api.ts` para o porquê do nome) exige um token
 * PRÓPRIO por instância — nós escolhemos o valor na criação, e ele vira a
 * senha de acesso a partir daí. É gravado em `access_token_enc`, a mesma
 * coluna cifrada que Google Calendar/Gmail já usam para o access token deles
 * — mesmo risco (quem lê essa coluna pode agir em nome da conexão), mesma
 * defesa.
 */
export type ResultadoDaConexao =
  | { ok: true; qrCode: string | null; jaConectado?: boolean }
  | { ok: false; erro: string }

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

/** Lê o token cifrado da conexão já existente, decifrado. `null` se não existe. */
async function obterTokenDaInstancia(workspaceId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('integration_connections')
    .select('access_token_enc')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'whatsapp')
    .maybeSingle()

  if (!data?.access_token_enc) return null
  return decifrar(data.access_token_enc as unknown as string)
}

/**
 * Cria a instância no Evolution GO e devolve o QR Code para leitura.
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

    // Reconectar depois de uma queda é o caminho comum numa API não oficial:
    // reusa o token já gravado em vez de criar instância nova (o Evolution
    // GO recusaria o mesmo instanceId com token diferente) — só gera um
    // token novo quando esta empresa nunca conectou antes.
    let token = await obterTokenDaInstancia(workspaceId)
    if (!token) {
      token = randomBytes(24).toString('hex')
      await criarInstancia(workspaceId, `velofunil-${workspaceId}`, token)
    }

    // O Evolution não assina o payload do webhook, então a URL carrega um
    // segredo que autentica a chamada. Ver o cabeçalho da rota.
    const segredo = process.env.EVOLUTION_WEBHOOK_SECRET
    const webhookUrl = segredo
      ? `${appUrl()}/api/webhooks/evolution/${encodeURIComponent(workspaceId)}/${segredo}`
      : ''
    const { qrCode, jaConectado } = await conectarInstancia(token, webhookUrl)

    // Sem QR e sem conexão, o motivo só existe do lado do servidor — a
    // resposta da API é a mesma para causa transitória e para falha de
    // infraestrutura. Registrar aqui é o que separa "tente de novo" de
    // "o Postgres da VPS está sem conexões livres".
    if (!qrCode && !jaConectado) {
      console.error('whatsapp: sessão não gerou QR', {
        workspaceId,
        motivo: await ultimoErroDaInstancia(workspaceId),
      })
    }

    // `upsert` e não `insert`: reconectar depois de uma queda é o caminho
    // comum numa API não oficial, e um insert cru estouraria na chave única.
    const admin = createAdminClient()
    await admin.from('integration_connections').upsert(
      {
        workspace_id: workspaceId,
        provider: 'whatsapp',
        // Reconectar um número que já estava pareado não devolve QR — e
        // gravar 'disconnected' aqui apagaria uma conexão viva do registro,
        // deixando a tela de Integrações dizendo "Não conectado" para quem
        // está conectado.
        status: jaConectado ? 'connected' : 'disconnected',
        external_id: workspaceId,
        access_token_enc: cifrar(token) as unknown as never,
        connected_by: userId,
        scopes: [],
      },
      { onConflict: 'workspace_id,provider' },
    )
    revalidatePath('/settings')
    return { ok: true, qrCode, jaConectado }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui falar com o servidor do WhatsApp.',
    }
  }
}

/** Busca um QR novo enquanto o diálogo está aberto (o anterior expirou). */
export async function renovarQrCode(workspaceId: string): Promise<ResultadoDaConexao> {
  try {
    await exigirAdmin(workspaceId)
    const token = await obterTokenDaInstancia(workspaceId)
    if (!token) return { ok: false, erro: 'Conexão não encontrada. Tente conectar de novo.' }
    const qrCode = await obterQrCode(token)
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
    const token = await obterTokenDaInstancia(workspaceId)
    if (!token) return { conectado: false, numero: null }

    const instancia = await obterEstado(token)
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
