import { CalendarClock, Check, CheckCheck } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A prévia da caixa de entrada do Max, desenhada em HTML.
 *
 * ## Por que HTML e não um print
 *
 * O projeto já pagou essa conta em 16/09: captura de tela inteira **não
 * sobrevive a caixa estreita**. Um print de 1440px dentro de uma coluna de
 * ~560px cai para 0,44x de escala, contra a régua de 09/09 que reprova abaixo
 * de 0,80x, e o texto vira borrão. Em HTML a prévia é legível em qualquer
 * largura, escala com o tema e pesa zero byte de imagem.
 *
 * ## O que ela precisa mostrar, e nada além
 *
 * A promessa do Max não é "tem WhatsApp". É que a conversa chega **com o
 * negócio do lado** e que um **relógio** diz há quanto tempo a pessoa espera.
 * As duas coisas estão aqui e o resto foi cortado: uma prévia que tenta mostrar
 * a tela inteira não mostra nada.
 *
 * Esta frase descrevia o critério de ordenação antigo até 18/09, quando a lista
 * passou a pôr a mais recente no topo. O que a prévia DESENHA continuou certo,
 * o relógio âmbar de "esperando há 12 min", e era só o texto que apontava para
 * a regra velha. Ver `lib/conversas/ordenar.ts`.
 *
 * `aria-hidden` porque é ilustração: quem usa leitor de tela recebe a mesma
 * informação no cartão ao lado, em texto de verdade, e ouvir uma conversa
 * inventada no meio de uma oferta seria ruído.
 */
export function PreviaDoWhatsapp({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'bg-muted/20 ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          MS
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Marcenaria Silva</p>
          {/* O tempo de espera, e não "2 não lidas": o contador de não lidas
              responde "quantas deixei passar", e este relógio responde "há
              quanto tempo esta pessoa está esperando". É a segunda que decide
              de quem cuidar agora, e é o argumento do Max. */}
          <p className="text-xs text-amber-600 dark:text-amber-500">esperando há 12 min</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Balao lado="recebida">Bom dia! Conseguiu ver o orçamento do portão?</Balao>
        <Balao lado="enviada">
          Vi sim. Te mando a proposta ainda hoje.
          <CheckCheck aria-hidden className="ml-1 inline size-3 align-[-1px] opacity-70" />
        </Balao>
        <Balao lado="recebida">Fico no aguardo, obrigado!</Balao>
      </div>

      {/* O negócio "do lado", que é a frase que o cartão promete. Ele fecha a
          prévia porque é a diferença entre isto e o WhatsApp Web. */}
      <div className="border-border/60 bg-card flex items-center gap-3 rounded-lg border p-3">
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
          <Check aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Portão de correr</p>
          {/* Sem valor em reais, e nao por estetica: `preco-na-tela.test.ts`
              proibe `R$ <numero>` na tela desde 10/09, quando um literal
              sobreviveu a duas auditorias. A regra e ampla de proposito, e
              abrir excecao para uma ilustracao criaria o precedente que ela
              existe para fechar. O valor tambem nao e o argumento: o que a
              previa precisa mostrar e o negocio AO LADO da conversa e o prazo
              correndo. */}
          <p className="text-muted-foreground text-xs">Proposta enviada</p>
        </div>
        <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
          <CalendarClock aria-hidden className="size-3.5" />
          vence em 2 dias
        </span>
      </div>
    </div>
  )
}

function Balao({
  lado,
  children,
}: {
  lado: 'recebida' | 'enviada'
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex', lado === 'enviada' && 'justify-end')}>
      <p
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug',
          lado === 'recebida'
            ? 'bg-card text-card-foreground ring-foreground/10 rounded-bl-sm ring-1'
            : 'bg-primary text-primary-foreground rounded-br-sm',
        )}
      >
        {children}
      </p>
    </div>
  )
}
