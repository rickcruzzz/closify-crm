import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PlanComparisonTable } from '@/components/settings/plan-comparison-table'
import { SubscribeButton } from '@/components/settings/subscribe-button'
import { SubscriptionCard } from '@/components/settings/subscription-card'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceSettingsData } from '@/lib/workspace/queries'
import { getEstadoAssinatura } from '@/lib/asaas/queries'
import { FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT } from '@/lib/plans'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Cobrança' }

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ assinar?: string; pago?: string }>
}) {
  const { assinar, pago } = await searchParams
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const { workspace, members } = await getWorkspaceSettingsData(workspaceId)
  const plan = workspace?.plan ?? 'free'

  const isAdmin = members.find((m) => m.user_id === user.id)?.role === 'admin'

  const supabase = await createClient()
  const { count: leadCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  // Estado real da cobrança, não só o plano. Sem isto, quem tinha assinatura
  // criada com fatura em aberto via "Free" e um botão de assinar de novo —
  // sem saber que já existia uma cobrança esperando pagamento.
  const assinatura = await getEstadoAssinatura(workspaceId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cobrança" description="Plano atual e comparação de recursos." />

      {/* Volta do Asaas depois de pagar. O Pro não é liberado aqui e sim pelo
          webhook, que é assíncrono — Pix costuma levar segundos, boleto pode
          levar dias. Sem este aviso a pessoa voltaria, veria "Free" e concluiria
          que o pagamento não funcionou. */}
      {pago === '1' && plan !== 'pro' && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Pagamento recebido</CardTitle>
            <CardDescription>
              Estamos aguardando a confirmação do Asaas para liberar o Pro. Pix costuma
              levar alguns segundos; boleto, até três dias úteis. Você recebe um e-mail
              assim que estiver ativo.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
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
              <UsageBar label="Leads" used={leadCount ?? 0} limit={FREE_LEAD_LIMIT} />
              <UsageBar
                label="Colaboradores"
                used={members.length}
                limit={FREE_MEMBER_LIMIT}
              />
            </div>
          )}

          {/* A assinatura aparece sempre que existir, inclusive no plano Free:
              é justamente quem criou a cobrança e ainda não pagou que precisa
              ver a fatura em aberto. */}
          {assinatura && <SubscriptionCard estado={assinatura} isAdmin={isAdmin} />}

          {/* Só oferece assinar quem não tem cobrança em andamento — senão a
              pessoa criaria uma segunda assinatura sem perceber que a primeira
              está esperando pagamento. */}
          {plan === 'free' &&
            isAdmin &&
            (!assinatura || assinatura.status === 'canceled') && (
              <SubscribeButton abrirDeInicio={assinar === '1'} />
            )}
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

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number
}) {
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
