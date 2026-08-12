import type { Metadata } from 'next'
import {
  getDashboardMetrics,
  getFunnelCounts,
  getUpcomingDeals,
} from '@/lib/dashboard/queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { lerEstadoDoOnboarding } from '@/lib/onboarding/estado'
import { lerSinaisDeAtivacao } from '@/lib/onboarding/sinais'
import { checklistCumprido, montarChecklist } from '@/lib/onboarding/checklist'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCards } from '@/components/dashboard/metric-cards'
import { FunnelChart } from '@/components/dashboard/funnel-chart'
import { UpcomingDealsTable } from '@/components/dashboard/upcoming-deals-table'
import { ChecklistCard } from '@/components/onboarding/checklist-card'
import { TourDeBoasVindas } from '@/components/onboarding/tour'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const { workspaceId } = await getCurrentUserAndWorkspace()

  const [metrics, funnelData, upcomingDeals, sinais, estado] = await Promise.all([
    getDashboardMetrics(workspaceId),
    getFunnelCounts(workspaceId),
    getUpcomingDeals(workspaceId),
    lerSinaisDeAtivacao(workspaceId),
    lerEstadoDoOnboarding(),
  ])

  const itens = montarChecklist(sinais)

  // Três condições para o checklist aparecer, e todas precisam ser verdade:
  // ainda há item aberto, a pessoa não fechou o card, e o onboarding não foi
  // ignorado por completo. Quem pulou tudo pediu para ser deixado em paz.
  const mostrarChecklist =
    !checklistCumprido(itens) && !estado.checklistOculto && estado.status !== 'skipped'

  // O tour abre pelo ESTADO, não por parâmetro de URL.
  //
  // A primeira versão dependia de `?tour=1`, posto pela finalização do
  // assistente — e quem entra por CONVITE nunca passa por lá, então nunca
  // veria o tour, apesar de ser tão novo no produto quanto qualquer um.
  //
  // Chegar aqui já exige empresa: `getCurrentUserAndWorkspace` desvia para o
  // onboarding quem não tem. E quem pulou o onboarding tem o tour marcado como
  // pulado junto, então não é incomodado.
  const abrirTour = estado.tourStatus === 'not_started'

  // O dashboard mostra os três painéis sempre, inclusive em workspace novo.
  // Antes o guia de primeiros passos entrava aqui e escondia funil e prazos
  // até existir dado — o que deixava a tela do recém-chegado sem a forma do
  // produto e mudava o layout debaixo dele assim que o primeiro negócio
  // entrava. Cada painel já tem estado vazio próprio, e o guia mudou para o
  // Pipeline, onde a ação de fato acontece.
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Métricas do seu funil de vendas." />

      {mostrarChecklist && <ChecklistCard itens={itens} />}

      <MetricCards metrics={metrics} />

      <FunnelChart data={funnelData} />

      <UpcomingDealsTable deals={upcomingDeals} />

      {abrirTour && <TourDeBoasVindas aberto />}
    </div>
  )
}
