import type { Metadata } from 'next'
import { getBoardDeals, getDealAvulso, getWorkspaceLeadsForSelect } from '@/lib/deals/queries'
import { dealStages, type DealStage } from '@/lib/deals/types'
import { getWorkspaceMembers } from '@/lib/leads/queries'
import { getProximaAcaoPorNegocio } from '@/lib/tasks/queries'
import { getIntegrationConnections } from '@/lib/integrations/queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { PageHeader } from '@/components/layout/page-header'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { GettingStartedCard } from '@/components/kanban/getting-started-card'
import { CABECALHOS } from '@/lib/telas/cabecalhos'

export const metadata: Metadata = { title: 'Funil' }

/**
 * O funil, opcionalmente com uma etapa em foco ou um negocio aberto.
 *
 * Ate 26/08/2026 esta pagina nao aceitava parametro nenhum, e era por isso que
 * o dashboard nao conseguia abrir nada: os paineis mostravam numero de negocio
 * e prazo, e nao existia endereco para o qual mandar quem clicasse.
 *
 *     /kanban?etapa=proposta_enviada   a coluna entra na tela, destacada
 *     /kanban?negocio=<id>             o painel do negocio abre de cara
 */
export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string; negocio?: string }>
}) {
  const params = await searchParams
  const { user, workspaceId } = await getCurrentUserAndWorkspace()

  // Quinta consulta no mesmo `Promise.all`, não uma por card: o board já
  // carrega todos os negócios abertos de uma vez, e uma consulta por card
  // multiplicaria o custo em vez de somar uma leitura.
  const [board, leads, members, proximasAcoes, integracoes] = await Promise.all([
    getBoardDeals(workspaceId),
    getWorkspaceLeadsForSelect(workspaceId),
    getWorkspaceMembers(workspaceId),
    getProximaAcaoPorNegocio(workspaceId),
    getIntegrationConnections(workspaceId),
  ])

  // Valor fora do enum vira "sem foco" em vez de erro: o parametro vem da
  // URL, e URL e digitavel por qualquer um.
  const etapaEmFoco = (dealStages as readonly string[]).includes(params.etapa ?? '')
    ? (params.etapa as DealStage)
    : null

  // O board traz no maximo 200 por etapa. Um link para um negocio fora desse
  // corte abriria painel vazio, que e o mesmo beco sem saida por outro
  // caminho. A consulta extra so acontece quando o parametro existe E o
  // negocio nao veio no board.
  const negocioPedido = params.negocio ?? null
  let deals = board.deals

  if (negocioPedido && !deals.some((d) => d.id === negocioPedido)) {
    const avulso = await getDealAvulso(workspaceId, negocioPedido)
    if (avulso) deals = [...deals, avulso]
  }

  // So abre o painel se o negocio EXISTE de verdade.
  //
  // Sem esta linha, `?negocio=<id-que-nao-existe>` abria um painel em branco:
  // o board so testa se ha id selecionado, nao se ele casa com algum negocio.
  // Link velho, negocio apagado ou id de outra empresa (que a RLS recusa)
  // caem todos aqui, e um painel vazio e o mesmo beco sem saida por outro
  // caminho. Achado pelo proprio roteiro de prova.
  const negocioParaAbrir =
    negocioPedido && deals.some((d) => d.id === negocioPedido) ? negocioPedido : null

  // Só pra saber se dá pra oferecer "mandar pro Google Calendar" no painel
  // do negócio, mesma função que a aba Integrações usa, uma consulta leve.
  const calendarConectado = integracoes.some(
    (c) => c.provider === 'google_calendar' && c.status === 'connected',
  )

  return (
    // `max-w-none` desfaz o teto de 1160px do layout: o board rola na
    // horizontal e espremê-lo esconderia colunas atrás da rolagem.
    <div className="-mx-4 max-w-none px-4 md:-mx-6 md:px-6">
      <PageHeader {...CABECALHOS.kanban} />

      {/* Board completamente vazio: mostra o guia acima dele. A condição é
          resolvida no servidor, sobre `deals`, não sobre o resultado do filtro
          do board, quem filtrou até zerar a tela não é um usuário novo e não
          deve receber tutorial. */}
      {board.deals.length === 0 && <GettingStartedCard />}

      <KanbanBoard
        initialDeals={deals}
        totalPorEtapa={board.totalPorEtapa}
        leads={leads}
        members={members}
        currentUserId={user.id}
        // `Map` não sobrevive à serialização servidor→cliente; vai como pares.
        proximasAcoes={Array.from(proximasAcoes)}
        calendarConectado={calendarConectado}
        negocioInicial={negocioParaAbrir}
        etapaEmFoco={etapaEmFoco}
      />
    </div>
  )
}
