import { IntegrationCard } from '@/components/settings/integration-card'
import type { IntegrationConnectionRow } from '@/lib/integrations/queries'
import type { IntegrationProvider } from '@/types/supabase'
import type { PlanoEfetivo } from '@/lib/plans'

const PROVIDERS: IntegrationProvider[] = ['google_calendar', 'gmail', 'whatsapp']

export function IntegrationsTab({
  isAdmin,
  connections,
  uso,
  plano,
}: {
  isAdmin: boolean
  connections: IntegrationConnectionRow[]
  uso: Record<IntegrationProvider, number>
  /**
   * O plano EFETIVO, de `planoEfetivo()`. Só decide o que o card mostra; a
   * regra real está no servidor.
   *
   * Era `'free' | 'pro'`, e o tipo era parte do defeito: ele impedia passar o
   * resultado de `planoEfetivo()` sem tocar aqui, então quem corrigisse a
   * página tomaria um erro do `tsc` e poderia desistir no meio.
   */
  plano: PlanoEfetivo
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PROVIDERS.map((provider) => {
        const conexao = connections.find((c) => c.provider === provider)
        return (
          <IntegrationCard
            key={provider}
            provider={provider}
            isAdmin={isAdmin}
            status={conexao?.status ?? 'disconnected'}
            accountLabel={conexao?.accountLabel ?? null}
            lastError={conexao?.lastError ?? null}
            uso={uso[provider]}
            plano={plano}
          />
        )
      })}
    </div>
  )
}
