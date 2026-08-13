import type { Metadata } from 'next'
import {
  getDashboardMetrics,
  getFunnelCounts,
  getUpcomingDeals,
} from '@/lib/dashboard/queries'
import { resolverPeriodo } from '@/lib/dashboard/periodo'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { lerEstadoDoOnboarding } from '@/lib/onboarding/estado'
import { lerSinaisDeAtivacao } from '@/lib/onboarding/sinais'
import { checklistCumprido, montarChecklist } from '@/lib/onboarding/checklist'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCards } from '@/components/dashboard/metric-cards'
import { FunnelChart } from '@/components/dashboard/funnel-chart'
import { UpcomingDealsTable } from '@/components/dashboard/upcoming-deals-table'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { ChecklistCard } from '@/components/onboarding/checklist-card'
import { TourDeBoasVindas } from '@/components/onboarding/tour'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; ate?: string }>
}) {
  const params = await searchParams
  const { workspaceId } = await getCurrentUserAndWorkspace()

  // `new Date()` aqui é só o instante "agora" pra ancorar o cálculo — quem
  // decide o que é "hoje" de verdade é `resolverPeriodo` via `diaEmSaoPaulo`,
  // não o relógio UTC do servidor.
  const periodo = resolverPeriodo(
    new Date(),
    params.periodo ?? null,
    params.desde ?? null,
    params.ate ?? null,
  )

  // `getUpcomingDeals` fica de fora do período de propósito: é sobre prazo
  // FUTURO (due_date), não sobre quando o negócio nasceu — filtrar isso por
  // "criado nos últimos 7 dias" misturaria dois conceitos diferentes.
  const [metrics, funnelData, upcomingDeals, sinais, estado] = await Promise.all([
    getDashboardMetrics(workspaceId, periodo),
    getFunnelCounts(workspaceId, periodo),
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

      <PeriodFilter
        presetAtivo={params.desde ? null : (params.periodo ?? null)}
        desdeAtivo={params.desde ?? null}
        ateAtivo={params.ate ?? null}
      />

      {mostrarChecklist && <ChecklistCard itens={itens} />}

      <MetricCards metrics={metrics} />

      <FunnelChart data={funnelData} />

      <UpcomingDealsTable deals={upcomingDeals} />

      {abrirTour && <TourDeBoasVindas aberto />}
    </div>
  )
}
