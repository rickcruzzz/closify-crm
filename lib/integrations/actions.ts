'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { decifrar } from '@/lib/integrations/crypto'
import { revogarToken as revogarTokenGoogle, testarCalendario, testarGmail } from '@/lib/integrations/google'
import { obterAccessTokenValido } from '@/lib/integrations/token'
import type { IntegrationProvider } from '@/types/supabase'

/**
 * Confere admin pela RPC, não por leitura direta de `workspace_members`.
 *
 * Mesmo padrão de `lib/asaas/actions.ts`, a RPC já existe, já é testada, e
 * evita reimplementar a regra "admin = role admin no workspace" em mais um
 * lugar.
 */
async function exigirAdmin(workspaceId: string) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })
  if (!isAdmin) {
    throw new Error('somente_admin')
  }
  return supabase
}

/**
 * Desconecta uma integração.
 *
 * Lê o token com a service role (as colunas de token não são legíveis por
 * `authenticated`, revoke da migration 0034) só para tentar revogar do lado
 * do provedor. O DELETE em si roda com o client da sessão, respeitando RLS:
 * a régua de "quem pode desconectar" já está na policy, não precisa
 * duplicá-la aqui.
 */
export async function desconectarIntegracao(provider: IntegrationProvider) {
  const { workspaceId } = await getCurrentUserAndWorkspace()

  let supabase
  try {
    supabase = await exigirAdmin(workspaceId)
  } catch {
    return { error: 'Apenas administradores podem gerenciar integrações.' }
  }

  const admin = createAdminClient()
  const { data: linha } = await admin
    .from('integration_connections')
    .select('access_token_enc')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .maybeSingle()

  if (linha?.access_token_enc) {
    try {
      await revogarTokenGoogle(decifrar(linha.access_token_enc))
    } catch (err) {
      // Não bloqueia a desconexão local, ver comentário em revogarToken().
      console.error('Falha ao revogar token remoto na desconexão', err)
    }
  }

  const { error } = await supabase
    .from('integration_connections')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)

  if (error) {
    console.error('desconectarIntegracao falhou', error)
    return { error: 'Não foi possível desconectar. Tente novamente.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

/**
 * Testa a conexão com uma ida real e barata ao provedor.
 *
 * Renova o access_token primeiro se ele está expirado ou perto de expirar,
 * sem isso, todo teste feito mais de uma hora depois de conectar (validade
 * típica de access_token do Google) devolveria "erro" mesmo com a integração
 * saudável, só porque o token expirou entre uma chamada e outra.
 */
export async function testarConexaoIntegracao(provider: IntegrationProvider) {
  const { workspaceId } = await getCurrentUserAndWorkspace()

  let supabase
  try {
    supabase = await exigirAdmin(workspaceId)
  } catch {
    return { error: 'Apenas administradores podem gerenciar integrações.' }
  }

  // Mesma razão de workflow-actions.ts: `obterAccessTokenValido` roda com
  // service role e renovaria o token mesmo com o Pro vencido, sem isto.
  const { data: podeUsar } = await supabase.rpc('pro_vigente', {
    target_workspace_id: workspaceId,
  })
  if (!podeUsar) {
    return { error: 'Seu Pro venceu. Reative o plano para continuar usando integrações.' }
  }

  const resultado = await obterAccessTokenValido(workspaceId, provider)
  if ('error' in resultado) {
    revalidatePath('/settings')
    return { error: resultado.error }
  }

  const ok =
    provider === 'google_calendar'
      ? await testarCalendario(resultado.accessToken)
      : await testarGmail(resultado.accessToken)

  const admin = createAdminClient()
  await admin
    .from('integration_connections')
    .update({
      status: ok ? 'connected' : 'error',
      last_error: ok ? null : 'A conexão respondeu com erro. Tente reconectar.',
      last_synced_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)

  revalidatePath('/settings')
  return ok ? { success: true } : { error: 'A conexão respondeu com erro. Tente reconectar.' }
}
