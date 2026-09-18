import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DealRow, DealLeadRow } from '@/lib/deals/queries'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ProximaAcao } from '@/components/kanban/proxima-acao'
import type { ProximaAcaoRow } from '@/lib/tasks/types'
import { formatarValorDeNegocio } from '@/lib/deals/metrics'
import { estadoDeMovimento, etapaFechada } from '@/lib/deals/parado'
import { dataExataCurta } from '@/lib/kanban/data-exata'
import { iniciais } from '@/lib/leads/iniciais'
import { corDaUrgencia, urgenciaDoParado } from '@/lib/kanban/urgencia'

// `React.memo`: `handleDragOver` (kanban-board.tsx) só troca o objeto do
// card ATIVO a cada tick de arrasto, `prev.map` mantém a mesma referência
// pros demais. Sem memo, mover um card re-renderizava todo o board inteiro
// (todas as colunas, todos os cards) a cada cruzamento de coluna; boards
// com dezenas/centenas de negócios sentiam isso como travamento.
export const DealCard = React.memo(function DealCard({
  deal,
  lead,
  proximaAcao,
  onOpen,
  onAgendar,
  agora,
  mostrarResponsavel = true,
}: {
  deal: DealRow
  lead: DealLeadRow | undefined
  /** A tarefa aberta mais próxima deste negócio. Ausente: não há nenhuma. */
  proximaAcao: ProximaAcaoRow | undefined
  onOpen: (dealId: string) => void
  /** Abre o negócio já com o agendamento aberto, a partir do aviso do card. */
  onAgendar: (dealId: string) => void
  /**
   * O relógio do board, criado no CLIENTE.
   *
   * `null` antes do primeiro efeito: o servidor da Vercel roda em UTC e
   * calcular "parado há N dias" lá erraria a virada do dia. Sem ele, o card
   * simplesmente não fala de tempo, em vez de arriscar um número errado.
   */
  agora: Date | null
  /**
   * Mostrar o avatar do responsável.
   *
   * `false` quando a empresa tem UMA pessoa. Medido no board de prova: o mesmo
   * "MD" aparecia em 42 de 42 cards. Informação que é idêntica em todos os
   * cards não distingue nenhum deles — é a mesma razão pela qual a coluna
   * "Responsável" do dashboard repete o mesmo nome cinco vezes. Com equipe de
   * verdade ela volta sozinha, porque a condição é derivada do número de
   * membros, não gravada.
   */
  mostrarResponsavel?: boolean
}) {
  // A informação já existia e não aparecia: `estadoDeMovimento` alimentava só
  // o botão de filtro "Parados", então um negócio movido ontem e outro
  // congelado há dois meses tinham cards idênticos.
  const movimento = agora ? estadoDeMovimento(deal, agora) : null
  const fechada = etapaFechada(deal.stage)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: deal.id,
      data: { stage: deal.stage },
    })

  return (
    <div
      ref={setNodeRef}
      // O guia interativo destaca o primeiro card visivel para ensinar a
      // validade do orcamento. Atributo dedicado, e nao a classe: `className`
      // aqui existe para o anel de foco e muda com o desenho.
      data-tour="card-de-negocio"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // O dnd-kit espalha `tabIndex={0}` e `role="button"` pelo `attributes`,
      // ou seja este div É alvo de teclado — e era o ÚNICO foco da tela sem
      // anel, caindo no contorno padrão do navegador enquanto todo o resto do
      // repositório usa `focus-visible:ring-3`. Ele é a alça de arrasto, o
      // alvo mais importante do board por teclado.
      className="focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3"
      onClick={() => onOpen(deal.id)}
      {...attributes}
      {...listeners}
    >
      {/* ## A borda colorida por etapa SAIU, e isso é subtração de propósito

          Cada card carregava `border-l-2` na cor da própria etapa. Só que o
          card está DENTRO da coluna daquela etapa, com o nome dela escrito no
          cabeçalho logo acima: a barra repetia, em cor, a única informação que
          o board já garante por posição.

          O custo não era o pixel. Com seis cores saturadas empilhadas em seis
          colunas, o board inteiro virava um arco-íris, e aí a cor parou de
          poder significar qualquer outra coisa — inclusive as duas que
          importam, que são atraso e parado. A cor de etapa continua existindo
          onde ela AINDA distingue: o ponto no cabeçalho da coluna, e o card
          solto do `DragOverlay`, que durante o arrasto está fora de qualquer
          coluna e precisa dizer de onde veio.

          Ganho medido junto: sem a borda, o conteúdo recupera 2px de largura
          útil em cada um dos 288px da coluna. */}
      <Card
        size="sm"
        className={cn(
          'hover:bg-accent/40 hover:ring-foreground/20 cursor-grab transition-[background-color,box-shadow] duration-150 active:cursor-grabbing motion-reduce:transition-none',
          // Fechado não some e não fica igual ao aberto: ele desce um degrau de
          // contraste. Ganho e perdido já cumpriram o papel deles, e competir
          // por atenção com o que ainda está em jogo é o oposto do que o board
          // serve para fazer.
          fechada && 'opacity-80',
          isDragging && 'opacity-40',
        )}
      >
        <CardContent className="flex flex-col gap-1.5">
          {/* ## A ordem inverteu: NEGÓCIO antes de VALOR

              O valor vinha primeiro, em semibold, acima do título. Parece
              certo num CRM — e é errado para este board: medido em produção,
              **119 dos 132 negócios têm `value` zerado**, então o elemento
              mais proeminente da maioria dos cards era um `R$ 0,00` que não é
              um valor, é um campo em branco.

              O nome do negócio é o que identifica o card numa coluna de vinte.
              O valor qualifica esse nome. Essa é a ordem em que a pessoa
              procura: primeiro acha o negócio, depois pergunta quanto vale. */}
          <div className="flex flex-col items-start">
            {/* O card inteiro é o alvo de drag (dnd-kit ocupa Enter/Espaço
                para pegar e soltar), então abrir o detalhe precisa do próprio
                alvo focável, senão a ação fica inacessível por teclado. */}
            <button
              type="button"
              className="focus-visible:ring-ring/50 -my-1 flex min-h-11 max-w-full items-center truncate rounded-sm py-1 text-left text-sm font-medium outline-none hover:underline focus-visible:ring-3 md:min-h-6"
              onClick={(event) => {
                event.stopPropagation()
                onOpen(deal.id)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.stopPropagation()
                onOpen(deal.id)
              }}
            >
              {deal.title}
            </button>
            {lead && (
              <span className="text-muted-foreground truncate text-xs">
                {lead.company}
              </span>
            )}
          </div>

          <ValorDoNegocio valor={deal.value} />

          {/* Só aparece quando já preocupa. Negócio que anda normal não ganha
              texto nenhum: o card fala quando tem o que dizer. */}
          {movimento?.parado && (
            // ## A gradação que faltava, e ela nasce do próprio texto
            //
            // Isto era `text-destructive` fixo. O motivo estava certo — o
            // ramo âmbar de `urgenciaSemProximaAcao` era inalcançável aqui,
            // "uma constante vestida de cálculo" — e a correção congelou a
            // cor em um nível só. Medido no board de prova: **21 de 42 cards
            // em vermelho**, metade da tela.
            //
            // `urgenciaDoParado` usa a fronteira de 30 dias que o rótulo
            // antigo aplicava ao texto ("semanas" abaixo, "meses" acima).
            // Aquele rótulo saiu junto com o tempo relativo; o limiar ficou,
            // e a origem dele está em `lib/kanban/urgencia.ts`.
            <span
              className={cn(
                'flex min-w-0 items-center gap-1 text-xs font-medium',
                corDaUrgencia[urgenciaDoParado(movimento.dias)],
              )}
            >
              <Clock aria-hidden className="size-3 shrink-0" />
              {/* ## A DATA, não "parado há 3 semanas"

                  Pedido do dono em 16/09. "Há 3 semanas" obriga quem lê a
                  reconstruir a data de cabeça antes de agir, e quem abre o
                  funil está decidindo para quem ligar hoje, com a agenda ao
                  lado: "qua • 14:30" entra na agenda, "em 3 dias" precisa
                  virar quarta primeiro.

                  A palavra "Parado" fica, porque ela é o ESTADO e continua
                  sendo o que a cor explica. O que saiu foi só a contagem
                  relativa. E os dois vêm de campos diferentes, que a tela
                  agora não mistura: aqui é `stage_changed_at`, a última
                  movimentação; o prazo, logo ao lado, é `due_at` da tarefa.

                  Nenhum cálculo mudou: `estadoDeMovimento` continua decidindo
                  o que é parado, e `urgenciaDoParado` continua decidindo a
                  cor. */}
              <span className="truncate">
                Parado desde {dataExataCurta(deal.stage_changed_at)}
              </span>
            </span>
          )}

          <div
            className={cn(
              'mt-1 flex items-center gap-2',
              // Sem avatar, a próxima ação não fica órfã à direita de um vão
              // vazio de 240px: ela encosta na esquerda, alinhada com o resto
              // do card.
              mostrarResponsavel ? 'justify-between' : 'justify-start',
            )}
          >
            {mostrarResponsavel && (
              <Avatar size="sm">
                <AvatarFallback>{iniciais(deal.owner_name ?? '?')}</AvatarFallback>
              </Avatar>
            )}
            {/* ## Um vermelho por card, não dois

                "parado há 2 semanas" e "Sem próximo passo" dizem a mesma coisa
                por ângulos diferentes, e as duas pintavam de `destructive` ao
                mesmo tempo: duas de quatro linhas do card em alarme. É o
                próprio problema que `lib/kanban/urgencia.ts` nasceu para
                resolver ("o board inteiro estava vermelho"), voltando por uma
                porta nova.

                Quando a linha de parado já apareceu, ela carrega o alarme —
                ela tem o NÚMERO. O botão passa a `etapaFechada` para cair em
                `neutro` e sobrar como ação, sem repetir o grito. */}
            <ProximaAcao
              task={proximaAcao}
              onAgendar={() => onAgendar(deal.id)}
              diasParado={movimento?.dias ?? 0}
              etapaFechada={fechada || Boolean(movimento?.parado)}
              sabemosAData={movimento !== null}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

/**
 * O valor, e a diferença entre zero e em branco.
 *
 * `R$ 0,00` em negrito afirma que o negócio vale zero. Medido em produção:
 * **119 de 132 negócios estão com o campo vazio**, ou seja a afirmação seria
 * falsa em 90% dos cards, e ainda ocuparia o lugar de maior peso visual.
 *
 * Ausência de dado não é dado — a mesma regra que `textoDaConversao` aplica ao
 * percentual e que `medidasDeDesempenho` aplica ao ticket médio. Aqui ela vira
 * um rótulo discreto que diz o que fazer, em vez de um número que mente.
 *
 * Zero NEGATIVO ou positivo de verdade continua sendo mostrado: a condição é
 * `=== 0`, não "falsy", então um negócio de R$ 0,01 aparece normalmente.
 */
function ValorDoNegocio({ valor }: { valor: number }) {
  if (valor === 0) {
    return <span className="text-muted-foreground text-xs">Sem valor definido</span>
  }

  return (
    // `title` com o valor cheio: o card abrevia acima de um milhão para o
    // número não virar a coisa mais pesada do card, mas quem precisa do
    // centavo consegue ver passando o mouse.
    <span
      className="text-sm font-semibold tabular-nums"
      title={valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
    >
      {formatarValorDeNegocio(valor)}
    </span>
  )
}
