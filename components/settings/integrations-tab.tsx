import { IntegrationCard } from '@/components/settings/integration-card'
import type { IntegrationConnectionRow } from '@/lib/integrations/queries'
import type { IntegrationProvider } from '@/types/supabase'

const PROVIDERS: IntegrationProvider[] = ['google_calendar', 'gmail']

export function IntegrationsTab({
  isAdmin,
  connections,
  uso,
}: {
  isAdmin: boolean
  connections: IntegrationConnectionRow[]
  uso: Record<IntegrationProvider, number>
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
          />
        )
      })}
    </div>
  )
}
