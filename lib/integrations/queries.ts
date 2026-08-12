import { createClient } from '@/lib/supabase/server'
import type { IntegrationProvider, IntegrationStatus } from '@/types/supabase'

export type IntegrationConnectionRow = {
  provider: IntegrationProvider
  status: IntegrationStatus
  accountLabel: string | null
  lastError: string | null
  lastSyncedAt: string | null
}

/**
 * Lê só as colunas seguras — as de token nem estariam visíveis mesmo que
 * pedidas (revoke por coluna na migration 0034), mas a lista explícita aqui
 * é o que documenta a intenção: esta tela nunca precisa do token em si,
 * só do status.
 */
export async function getIntegrationConnections(
  workspaceId: string,
): Promise<IntegrationConnectionRow[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('integration_connections')
    .select('provider, status, account_label, last_error, last_synced_at')
    .eq('workspace_id', workspaceId)

  return (data ?? []).map((linha) => ({
    provider: linha.provider,
    status: linha.status,
    accountLabel: linha.account_label,
    lastError: linha.last_error,
    lastSyncedAt: linha.last_synced_at,
  }))
}
