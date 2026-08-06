import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlanComparisonTable } from '@/components/settings/plan-comparison-table'
import { SubscribeButton } from '@/components/settings/subscribe-button'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceSettingsData } from '@/lib/workspace/queries'
import { FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT } from '@/lib/limits'
import { cn } from '@/lib/utils'

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
                ? 'Colaboradores e leads ilimitados.'
                : 'Ideal para começar a organizar seu funil.'}
            </CardDescription>
          </div>
          <Badge variant={plan === 'pro' ? 'default' : 'secondary'}>
            {plan === 'pro' ? 'Pro' : 'Free'}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {plan === 'free' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <UsageBar
                label="Leads"
                used={leadCount ?? 0}
                limit={FREE_LEAD_LIMIT}
              />
              <UsageBar
                label="Colaboradores"
                used={members.length}
                limit={FREE_MEMBER_LIMIT}
              />
            </div>
          )}

          {plan === 'free' && isAdmin && <SubscribeButton />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compare os planos</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanComparisonTable plan={plan} />
        </CardContent>
      </Card>
    </div>
  )
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = Math.min(100, Math.round((used / limit) * 100))
  const isNearLimit = percent >= 80

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium', isNearLimit && 'text-destructive')}>
          {used}/{limit}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isNearLimit ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {isNearLimit && (
        <p className="text-destructive text-xs">Perto do limite do plano Free.</p>
      )}
    </div>
  )
}
