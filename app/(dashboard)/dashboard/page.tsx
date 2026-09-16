import { Suspense } from 'react'
import type { Metadata } from 'next'
import { resolverPeriodo } from '@/lib/dashboard/periodo'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { lerEstadoDoOnboarding } from '@/lib/onboarding/estado'
import { lerSinaisDeAtivacao } from '@/lib/onboarding/sinais'
import { checklistCumprido, montarChecklist } from '@/lib/onboarding/checklist'
import { PageHeader } from '@/components/layout/page-header'
import { CABECALHOS } from '@/lib/telas/cabecalhos'
import { MetricCardsAsync } from '@/components/dashboard/metric-cards-async'
import { FunnelChartAsync } from '@/components/dashboard/funnel-chart-async'
import { UpcomingDealsTableAsync } from '@/components/dashboard/upcoming-deals-table-async'
import { PainelDeDesempenhoAsync } from '@/components/dashboard/painel-de-desempenho-async'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { ChecklistCard, RetomarChecklist } from '@/components/onboarding/checklist-card'
import { TourDeBoasVindas } from '@/components/onboarding/tour'
import { ReportArea } from '@/components/dashboard/report-area'
import { ExportReportButton } from '@/components/dashboard/export-report-button'
import { Skeleton } from '@/components/ui/skeleton'
import { rotuloDoPreset, type PresetDePeriodo } from '@/lib/dashboard/periodo'

export const metadata: Metadata = { title: 'Resultados' }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; ate?: string }>
}) {
  const params = await searchParams
  const { workspaceId, workspaces } = await getCurrentUserAndWorkspace()
  const nomeDoWorkspace =
    workspaces.find((w) => w.id === workspaceId)?.name ?? 'Velo Funil'

  // `new Date()` aqui é só o instante "agora" pra ancorar o cálculo, quem
  // decide o que é "hoje" de verdade é `resolverPeriodo` via `diaEmSaoPaulo`,
  // não o relógio UTC do servidor.
  const periodo = resolverPeriodo(
    new Date(),
    params.periodo ?? null,
    params.desde ?? null,
    params.ate ?? null,
  )

  // Métricas, funil e próximos prazos SAÍRAM deste `Promise.all` — cada um
  // virou seu próprio componente `async`, envolvido em `<Suspense>` abaixo.
  // Antes, a tela inteira ficava em branco até a mais lenta das 5 queries
  // terminar; agora só `sinais`/`estado` (rápidas, decidem SE o checklist e o
  // tour aparecem, não têm skeleton próprio) seguram a renderização inicial,
  // e cada painel pesado aparece assim que sua própria query resolve —
  // streaming de verdade, não spinner fingindo progresso.
  const [sinais, estado] = await Promise.all([
    lerSinaisDeAtivacao(workspaceId),
    lerEstadoDoOnboarding(),
  ])

  const itens = montarChecklist(sinais)

  // Três condições para o checklist aparecer, e todas precisam ser verdade:
  // ainda há item aberto, a pessoa não fechou o card, e o onboarding não foi
  // ignorado por completo. Quem pulou tudo pediu para ser deixado em paz.
  const aindaFalta = !checklistCumprido(itens) && estado.status !== 'skipped'
  const mostrarChecklist = aindaFalta && !estado.checklistOculto

  // Quem fechou o card continua vendo uma porta de volta, e só ela.
  // `ocultarChecklist(false)` existia desde sempre e nunca era chamada: até
  // 01/09 fechar o checklist era definitivo, e 9 das 49 contas já haviam
  // fechado sem ter como reabrir.
  const podeRetomar = aindaFalta && estado.checklistOculto
  const pendentes = itens.filter((i) => !i.concluido).length

  // ## O relatório de um negócio que ainda não começou
  //
  // Medido em 01/09 contra produção, com conta nova e empresa vazia: em
  // 375px o botão "Adicionar primeiro contato" fica a **984px** do topo, e a
  // tela do telefone tem **812px**. A única ação que importa nasce abaixo da
  // dobra, e o que a empurra para lá é "Exportar relatório" mais dez botões
  // de período — os dois calculados sobre zero linha.
  //
  // Não é excesso de zelo com pixel: 25 das 42 empresas do banco nunca
  // criaram um contato. Quem chega vê uma tela de RELATÓRIO de um negócio
  // que ainda não existe, com a ação de valor escondida no rodapé.
  //
  // Os dois voltam sozinhos no instante em que houver o primeiro contato,
  // porque a condição é derivada dos sinais, não gravada.
  const temAlgoParaRelatar = sinais.leads > 0 || sinais.negocios > 0

  // O tour abre pelo ESTADO, não por parâmetro de URL.
  //
  // A primeira versão dependia de `?tour=1`, posto pela finalização do
  // assistente, e quem entra por CONVITE nunca passa por lá, então nunca
  // veria o tour, apesar de ser tão novo no produto quanto qualquer um.
  //
  // Chegar aqui já exige empresa: `getCurrentUserAndWorkspace` desvia para o
  // onboarding quem não tem. E quem pulou o onboarding tem o tour marcado como
  // pulado junto, então não é incomodado.
  const abrirTour = estado.tourStatus === 'not_started'

  // Mesmo texto que `PeriodFilter` mostra na tela, para o relatório dizer o
  // período que ele de fato cobre sem precisar reabrir o produto para saber.
  const rotuloDoPeriodo = params.desde
    ? `${params.desde} até ${params.ate ?? params.desde}`
    : params.periodo && params.periodo in rotuloDoPreset
      ? rotuloDoPreset[params.periodo as PresetDePeriodo]
      : 'Todo o período'

  // O dashboard mostra os três painéis sempre, inclusive em workspace novo.
  // Antes o guia de primeiros passos entrava aqui e escondia funil e prazos
  // até existir dado, o que deixava a tela do recém-chegado sem a forma do
  // produto e mudava o layout debaixo dele assim que o primeiro negócio
  // entrava. Cada painel já tem estado vazio próprio, e o guia mudou para o
  // Pipeline, onde a ação de fato acontece.
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        {...CABECALHOS.dashboard}
        actions={
          temAlgoParaRelatar ? (
            <ExportReportButton
              nomeDoWorkspace={nomeDoWorkspace}
              rotuloDoPeriodo={rotuloDoPeriodo}
            />
          ) : null
        }
      />

      {temAlgoParaRelatar && (
        <PeriodFilter
          presetAtivo={params.desde ? null : (params.periodo ?? null)}
          desdeAtivo={params.desde ?? null}
          ateAtivo={params.ate ?? null}
        />
      )}

      {mostrarChecklist && <ChecklistCard itens={itens} />}
      {podeRetomar && <RetomarChecklist pendentes={pendentes} />}

      {/* Só o que entra no PDF: o checklist é sobre o produto, não sobre o
          negócio da pessoa, e um relatório com "Cadastre seu primeiro lead"
          impresso para o cliente não faz sentido nenhum. */}
      <ReportArea>
        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          }
        >
          <MetricCardsAsync workspaceId={workspaceId} periodo={periodo} />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <FunnelChartAsync workspaceId={workspaceId} periodo={periodo} />
        </Suspense>

        {/* O desempenho vem DEPOIS do funil, e a ordem é a da pergunta: o
            funil responde "onde estão meus negócios", o desempenho responde "o
            que os que já fecharam me ensinam". Invertido, a pessoa leria média
            de fechamento antes de saber quantos negócios existem.

            O painel some inteiro quando não há fechamento nenhum, e por isso
            não tem skeleton de altura fixa: reservar 100px para um card que
            talvez não exista deixaria buraco na tela de quem está começando. */}
        <Suspense fallback={null}>
          <PainelDeDesempenhoAsync workspaceId={workspaceId} periodo={periodo} />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <UpcomingDealsTableAsync workspaceId={workspaceId} />
        </Suspense>
      </ReportArea>

      {abrirTour && <TourDeBoasVindas aberto />}
    </div>
  )
}
