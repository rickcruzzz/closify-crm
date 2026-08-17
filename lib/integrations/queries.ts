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
 * Lê só as colunas seguras, as de token nem estariam visíveis mesmo que
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

const JANELA_DE_USO_EM_DIAS = 30

/**
 * Quantas atividades cada integração gerou nos últimos 30 dias.
 *
 * Conta por `integration_provider`, não por `type`, `type` (email/reunião)
 * também é escolha manual no formulário de atividade, então contar só por
 * ele misturaria "enviei pelo Gmail conectado" com "registrei que liguei
 * fora do sistema". `count: 'exact', head: true` só traz o número, sem
 * buscar linha nenhuma, mesmo espírito de agregação no banco que o
 * dashboard já usa.
 */
export async function getUsoDasIntegracoes(
  workspaceId: string,
): Promise<Record<IntegrationProvider, number>> {
  const supabase = await createClient()
  const desde = new Date(Date.now() - JANELA_DE_USO_EM_DIAS * 24 * 60 * 60 * 1000).toISOString()

  async function contar(provider: IntegrationProvider): Promise<number> {
    const { count } = await supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('integration_provider', provider)
      .gte('created_at', desde)
    return count ?? 0
  }

  const [googleCalendar, gmail] = await Promise.all([
    contar('google_calendar'),
    contar('gmail'),
  ])

  return { google_calendar: googleCalendar, gmail }
}
