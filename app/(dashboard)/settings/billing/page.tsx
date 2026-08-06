import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlanComparisonTable } from '@/components/settings/plan-comparison-table'
import { SubscribeButton } from '@/components/settings/subscribe-button'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceSettingsData } from '@/lib/workspace/queries'
import { FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT } from '@/lib/limits'

export default async function BillingPage() {
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const { workspace, members } = await getWorkspaceSettingsData(workspaceId)
  const plan = workspace?.plan ?? 'free'

  const isAdmin = members.find((m) => m.user_id === user.id)?.role === 'admin'

  const supabase = await createClient()
  const { count: leadCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cobrança" description="Plano atual e comparação de recursos." />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Plano atual</CardTitle>
            <CardDescription>
              {plan === 'pro'
                ? 'Pro — colaboradores e leads ilimitados.'
                : `Free — ${leadCount ?? 0}/${FREE_LEAD_LIMIT} leads, ${members.length}/${FREE_MEMBER_LIMIT} colaboradores.`}
            </CardDescription>
          </div>
          <Badge variant={plan === 'pro' ? 'default' : 'secondary'}>
            {plan === 'pro' ? 'Pro' : 'Free'}
          </Badge>
        </CardHeader>
        {plan === 'free' && isAdmin && (
          <CardContent>
            <SubscribeButton />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comparação de planos</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanComparisonTable plan={plan} />
        </CardContent>
      </Card>
    </div>
  )
}
