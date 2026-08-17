/**
 * Desfaz tudo que a rodada criou, no Asaas e no banco.
 *
 * Cada passo tem `try/catch` próprio de propósito: se cancelar no Asaas
 * falhar, o banco ainda precisa ser limpo, e vice-versa. Um `throw` no meio
 * deixaria metade do lixo para trás, que é pior do que nenhuma limpeza,
 * porque parece limpo.
 *
 * O retorno lista o que NÃO deu para remover. Quem chama tem obrigação de
 * mostrar isso: uma cobrança órfã em produção é o defeito que
 * `docs/estado-atual.md` registra (duas de R$49 em aberto no nome de uma
 * usuária real), e um teste que o repete em silêncio é pior que nenhum teste.
 */
import { asaas, bancoAdmin } from './ambiente'

export type Rastros = {
  userId?: string
  workspaceId?: string
  asaasCustomerId?: string
  asaasSubscriptionId?: string
  eventIds: string[]
}

export type ResultadoLimpeza = {
  removidos: string[]
  sobraram: string[]
}

export async function limpar(rastros: Rastros): Promise<ResultadoLimpeza> {
  const removidos: string[] = []
  const sobraram: string[] = []
  const supabase = bancoAdmin()

  async function tentar(rotulo: string, fn: () => Promise<unknown>) {
    try {
      await fn()
      removidos.push(rotulo)
    } catch (err) {
      sobraram.push(`${rotulo}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Asaas primeiro: é o que custa dinheiro se ficar para trás. Remover a
  // assinatura também cancela as cobranças pendentes geradas por ela.
  if (rastros.asaasSubscriptionId) {
    await tentar(`assinatura Asaas ${rastros.asaasSubscriptionId}`, () =>
      asaas(`/subscriptions/${rastros.asaasSubscriptionId}`, { method: 'DELETE' }),
    )
  }
  if (rastros.asaasCustomerId) {
    await tentar(`cliente Asaas ${rastros.asaasCustomerId}`, () =>
      asaas(`/customers/${rastros.asaasCustomerId}`, { method: 'DELETE' }),
    )
  }

  // Banco, na ordem das chaves estrangeiras.
  if (rastros.eventIds.length > 0) {
    await tentar('eventos de webhook', async () => {
      const { error } = await supabase
        .from('asaas_webhook_events')
        .delete()
        .in('event_id', rastros.eventIds)
      if (error) throw new Error(error.message)
    })
  }

  if (rastros.workspaceId) {
    for (const tabela of ['subscriptions', 'workspace_members'] as const) {
      await tentar(`${tabela} do workspace`, async () => {
        const { error } = await supabase
          .from(tabela)
          .delete()
          .eq('workspace_id', rastros.workspaceId!)
        if (error) throw new Error(error.message)
      })
    }
  }

  if (rastros.userId) {
    await tentar('onboarding_state', async () => {
      const { error } = await supabase
        .from('onboarding_state')
        .delete()
        .eq('user_id', rastros.userId!)
      if (error) throw new Error(error.message)
    })
  }

  if (rastros.workspaceId) {
    await tentar('workspace', async () => {
      const { error } = await supabase.from('workspaces').delete().eq('id', rastros.workspaceId!)
      if (error) throw new Error(error.message)
    })
  }

  if (rastros.userId) {
    await tentar('conta em auth.users', async () => {
      const { error } = await supabase.auth.admin.deleteUser(rastros.userId!)
      if (error) throw new Error(error.message)
    })
  }

  return { removidos, sobraram }
}

/**
 * Confere, DEPOIS de limpar, que nada com o carimbo da rodada continua no
 * banco. Confiar no "não deu erro ao apagar" não basta: um delete que não casa
 * com nenhuma linha também não dá erro (mesma armadilha do PATCH/204 que o
 * CLAUDE.md documenta).
 */
export async function conferirQueNadaSobrou(carimbo: string): Promise<string[]> {
  const supabase = bancoAdmin()
  const pendencias: string[] = []

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .ilike('name', `%${carimbo.slice(-6)}%`)
  if (workspaces && workspaces.length > 0) {
    pendencias.push(`workspaces ainda no banco: ${workspaces.map((w) => w.name).join(', ')}`)
  }

  const { data: assinaturas } = await supabase
    .from('subscriptions')
    .select('asaas_subscription_id')
    .like('asaas_customer_id', 'cus_%')
    .is('current_period_end', null)
  // Só reporta as que também não têm workspace, órfã de verdade.
  if (assinaturas) {
    for (const a of assinaturas) {
      const { count } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('asaas_subscription_id', a.asaas_subscription_id)
      if (count === 0) pendencias.push(`assinatura órfã: ${a.asaas_subscription_id}`)
    }
  }

  return pendencias
}
