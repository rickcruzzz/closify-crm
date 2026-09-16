import { cn } from '@/lib/utils'
import type { DealRow, DealLeadRow } from '@/lib/deals/queries'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ProximaAcao } from '@/components/kanban/proxima-acao'
import type { ProximaAcaoRow } from '@/lib/tasks/types'
import { formatarValorDeNegocio } from '@/lib/deals/metrics'
import { estadoDeMovimento, etapaFechada, rotuloDeParado } from '@/lib/deals/parado'
import { corDaUrgencia, urgenciaDoParado } from '@/lib/kanban/urgencia'
import { stageAccent } from '@/lib/deals/stage-colors'
import { Clock } from 'lucide-react'
import { iniciais } from '@/lib/leads/iniciais'

// Espelha `DealCard` de propósito, campo a campo. O overlay é o que a pessoa
// vê enquanto arrasta: se ele omitir a linha da próxima ação, o card muda de
// altura no instante em que é pego e o movimento parece um defeito.
export function DealCardOverlay({
  deal,
  lead,
  proximaAcao,
  agora,
  mostrarResponsavel = true,
}: {
  deal: DealRow
  lead: DealLeadRow | undefined
  proximaAcao: ProximaAcaoRow | undefined
  /**
   * O mesmo relógio que o card usa.
   *
   * Sem ele o overlay não renderizaria a linha de "parado há N dias" e o card
   * ENCOLHERIA no instante em que fosse pego — a armadilha que
   * `docs/estado-atual.md` já registra: este arquivo duplica a marcação de
   * `deal-card.tsx` à mão, e mudar um sem o outro faz o card trocar de altura
   * durante o arrasto, o que parece defeito.
   */
  agora: Date | null
  /** O mesmo do card: empresa de uma pessoa não mostra avatar. */
  mostrarResponsavel?: boolean
}) {
  const movimento = agora ? estadoDeMovimento(deal, agora) : null

  return (
    // ## A cor de etapa fica AQUI, e só aqui
    //
    // O card dentro da coluna perdeu a borda colorida em 16/09: ela repetia,
    // em cor saturada, a informação que a posição na coluna já dá. O overlay é
    // a exceção que justifica a regra — enquanto arrastado, o card está FORA
    // de qualquer coluna, e a cor passa a ser a única pista de onde ele veio.
    //
    // E ela sai de `lib/deals/stage-colors.ts`, a mesma fonte do ponto no
    // cabeçalho da coluna e das barras do funil no dashboard. Este arquivo
    // mantinha uma SEGUNDA tabela das mesmas seis cores, escrita como classes
    // `border-l-*`; com a saída da tabela do `deal-card.tsx`, ela virava a
    // única cópia divergente — e cópia que diverge em silêncio é a regra que
    // este projeto já pagou várias vezes.
    <Card
      size="sm"
      className="w-72 rotate-1 cursor-grabbing border-l-2 shadow-lg"
      style={{ borderLeftColor: stageAccent[deal.stage].bar }}
    >
      <CardContent className="flex flex-col gap-1.5">
        {/* A ORDEM espelha o card: título, empresa, valor. Inverter aqui
            faria o conteúdo trocar de lugar no instante do arrasto, que é a
            mesma classe de defeito da altura. */}
        <div className="flex flex-col items-start">
          {/* As classes de espaçamento copiam as do `<button>` do título em
              `deal-card.tsx` — `-my-1`, `min-h-6`, `py-1` — apesar de aqui ser
              um `<span>` (o overlay não é clicável). Sem elas o card mudava de
              altura ao ser pego: medido, 146px parado contra 151px no
              overlay, e um card que cresce no instante do arrasto parece
              defeito. */}
          <span className="-my-1 flex min-h-6 max-w-full items-center truncate py-1 text-sm font-medium">
            {deal.title}
          </span>
          {lead && (
            <span className="text-muted-foreground truncate text-xs">{lead.company}</span>
          )}
        </div>

        {deal.value === 0 ? (
          <span className="text-muted-foreground text-xs">Sem valor definido</span>
        ) : (
          <span className="text-sm font-semibold tabular-nums">
            {formatarValorDeNegocio(deal.value)}
          </span>
        )}

        {movimento?.parado && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              corDaUrgencia[urgenciaDoParado(movimento.dias)],
            )}
          >
            <Clock aria-hidden className="size-3 shrink-0" />
            {rotuloDeParado(movimento.dias)}
          </span>
        )}

        <div
          className={cn(
            'mt-1 flex items-center gap-2',
            mostrarResponsavel ? 'justify-between' : 'justify-start',
          )}
        >
          {mostrarResponsavel && (
            <Avatar size="sm">
              <AvatarFallback>{iniciais(deal.owner_name ?? '?')}</AvatarFallback>
            </Avatar>
          )}
          {/* Os TRÊS argumentos, como no card. Faltavam `etapaFechada` e
              `sabemosAData`: sem eles um negócio parado mostrava "Sem próximo
              passo" em vermelho enquanto arrastado e "Marcar próximo passo"
              em cinza parado — a mesma linha trocando de texto E de cor no
              instante em que o dedo desce. */}
          <ProximaAcao
            task={proximaAcao}
            diasParado={movimento?.dias ?? 0}
            etapaFechada={etapaFechada(deal.stage) || Boolean(movimento?.parado)}
            sabemosAData={movimento !== null}
          />
        </div>
      </CardContent>
    </Card>
  )
}
