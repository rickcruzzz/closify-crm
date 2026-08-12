'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { cifrar } from '@/lib/integrations/crypto'
import { obterInfoDoNumero, trocarCodigoPorTokenDoSistema } from '@/lib/integrations/whatsapp'

async function exigirAdmin(workspaceId: string) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })
  if (!isAdmin) throw new Error('somente_admin')
  return supabase
}

/**
 * Conclui a conexão do WhatsApp depois do Embedded Signup da Meta.
 *
 * Diferente do Google, não é redirect de página inteira — o SDK da Meta roda
 * num popup e devolve `code` + `phoneNumberId` + `wabaId` para esta página
 * via `postMessage` (ver `components/settings/whatsapp-connect-button.tsx`).
 * Por isso é Server Action chamada do client, e não uma rota de callback.
 *
 * O token obtido aqui não tem `refresh_token` no sentido do OAuth do Google
 * — é um token de sistema de longa duração (tipicamente 60 dias). Sem um
 * caminho de renovação automática, a reconexão manual periódica é uma
 * limitação conhecida (documentada em docs/estado-atual.md).
 */
export async function conectarWhatsapp(code: string, phoneNumberId: string, wabaId: string) {
  const { workspaceId, user } = await getCurrentUserAndWorkspace()

  let supabase
  try {
    supabase = await exigirAdmin(workspaceId)
  } catch {
    return { error: 'Apenas administradores podem conectar integrações.' }
  }

  if (!code || !phoneNumberId || !wabaId) {
    return { error: 'A Meta não devolveu os dados esperados. Tente conectar de novo.' }
  }

  try {
    const { access_token: accessToken } = await trocarCodigoPorTokenDoSistema(code)
    const info = await obterInfoDoNumero(phoneNumberId, accessToken)

    const { error } = await supabase.from('integration_connections').upsert(
      {
        workspace_id: workspaceId,
        provider: 'whatsapp',
        status: 'connected',
        account_label: info.display_phone_number,
        external_id: phoneNumberId,
        scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
        access_token_enc: cifrar(accessToken),
        refresh_token_enc: null,
        token_expires_at: null,
        last_error: null,
        connected_by: user.id,
      },
      { onConflict: 'workspace_id,provider' },
    )

    if (error) {
      console.error('conectarWhatsapp: falha ao gravar conexão', error)
      return { error: 'Não foi possível salvar a conexão. Tente novamente.' }
    }

    revalidatePath('/settings')
    return { success: true, numero: info.display_phone_number }
  } catch (err) {
    console.error('conectarWhatsapp falhou', err)
    return { error: 'Não foi possível conectar o WhatsApp. Tente novamente.' }
  }
}
