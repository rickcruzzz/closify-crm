'use client'

import * as React from 'react'
import { CircleAlert, CircleDashed } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rotuloDePrazo } from '@/lib/tasks/buckets'
import { iconePorTipo, type ProximaAcaoRow } from '@/lib/tasks/types'
import {
  corDaUrgencia,
  urgenciaDaProximaAcao,
  urgenciaSemProximaAcao,
} from '@/lib/kanban/urgencia'

/**
 * A próxima ação de um negócio, no canto do card do Kanban.
 *
 * Ocupa o lugar que era do prazo do negócio (`deal.due_date`), e não uma linha
 * a mais. Duas datas num card de 288px brigam: prazo é previsão, próxima ação
 * é ordem, e só uma das duas dá para cumprir hoje. O prazo continua visível no
 * painel de detalhe.
 *
 * Sem tarefa aberta, avisa. Negócio sem próximo passo é o que morre calado no
 * funil, e essa é a informação mais valiosa que o card pode dar, mais até do
 * que uma data.
 */
export function ProximaAcao({
  task,
  onAgendar,
  diasParado = 0,
}: {
  task: ProximaAcaoRow | undefined
  /**
   * Abre o agendamento direto do card.
   *
   * Sem isto, o aviso de "não tem próximo passo" era um `<span>` cinza escrito
   * "Ver ação": não clicava, não abria nada e não dizia o que fazer. Medido em
   * produção, 25 dos 26 negócios abertos estavam nesse estado, ou seja, 96% dos
   * cards mostravam um aviso morto.
   */
  onAgendar?: () => void
  /**
   * Há quantos dias o negócio não muda de etapa.
   *
   * Decide se a falta de próximo passo é alerta ou aviso: negócio criado hoje
   * sem tarefa ainda não errou nada; parado há duas semanas E sem próximo
   * passo são dois sinais na mesma direção.
   */
  diasParado?: number
}) {
  // O relógio nasce no cliente: o servidor da Vercel roda em UTC, e "atrasada"
  // calculada lá erraria por três horas todo fim de tarde.
  const [agora, setAgora] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setAgora(new Date())
  }, [])

  /**
   * O clique deste botão precisa de listener NATIVO em fase de captura.
   *
   * Medido no navegador: o `onClick` do React neste botão nunca disparava. O
   * dnd-kit registra `pointerdown` nativo no card inteiro (o card é o alvo de
   * arrasto) e chama `preventDefault()`, o que impede o navegador de sintetizar
   * o `click` no filho. Sem `click`, o React nunca chega a chamar o handler, e
   * o clique acabava caindo no `onClick` do `<div>` pai: o painel abria, mas
   * sem o agendamento, exatamente o passo que este aviso existe para poupar.
   *
   * `capture: true` no `pointerdown` roda ANTES do listener do dnd-kit e para
   * a propagação ali, então o arrasto não começa e o `click` nasce normal.
   */
  const aviso = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    const alvo = aviso.current
    if (!alvo) return

    const pegar = (event: Event) => event.stopPropagation()
    const clicar = (event: Event) => {
      event.stopPropagation()
      onAgendar?.()
    }

    alvo.addEventListener('pointerdown', pegar, true)
    alvo.addEventListener('click', clicar)
    return () => {
      alvo.removeEventListener('pointerdown', pegar, true)
      alvo.removeEventListener('click', clicar)
    }
  }, [onAgendar])

  const urgencia = urgenciaSemProximaAcao(diasParado)

  if (!task) {
    // Botão de verdade, com `stopPropagation` e Enter/Espaço tratados à mão:
    // o card inteiro é alvo de arrasto do dnd-kit, que ocupa essas teclas para
    // pegar e soltar. Mesmo padrão do botão do título em `deal-card.tsx`, e é
    // o que mantém a ação alcançável por teclado.
    return (
      <button
        type="button"
        // O texto visível descreve o ESTADO, que é o que serve para varrer o
        // board de olho ("quais destes estão largados?"). Mas nome acessível
        // precisa dizer a AÇÃO: sem isto o leitor de tela anunciava
        // "Sem próximo passo, botão", e o que o clique faz ficava invisível
        // justamente para quem não vê o cursor mudar nem o sublinhado do hover.
        aria-label="Agendar o próximo passo deste negócio"
        // A cor sai da urgência, não é fixa. Antes era sempre
        // `text-destructive`, a MESMA de uma tarefa vencida, e como 96% dos
        // negócios não têm próxima ação o board inteiro ficava vermelho —
        // alerta em tudo não distingue nada. Agora é âmbar por padrão e só
        // vira vermelho quando o negócio TAMBÉM está parado.
        className={cn(
          'focus-visible:ring-ring/50 -my-1 flex min-h-6 items-center gap-1 rounded-sm px-1 py-1 text-xs font-medium whitespace-nowrap outline-none hover:underline focus-visible:ring-3',
          corDaUrgencia[urgencia],
        )}
        ref={aviso}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.stopPropagation()
          onAgendar?.()
        }}
      >
        {/* Ícone diferente por nível, não só cor: a skill `ui-ux-pro-max`
            marca "não depender apenas de cor" e daltonismo é comum. */}
        {urgencia === 'critico' ? (
          <CircleAlert aria-hidden className="size-3" />
        ) : (
          <CircleDashed aria-hidden className="size-3" />
        )}
        Sem próximo passo
      </button>
    )
  }

  const Icone = iconePorTipo[task.type]

  // Antes de o efeito rodar não há relógio confiável. Mostra o ícone sem o
  // rótulo em vez de arriscar escrever "atrasada" para algo que não está.
  if (!agora) {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap">
        <Icone aria-hidden className="size-3" />
      </span>
    )
  }

  // Três níveis, não dois: tarefa de hoje ficava com a mesma cor cinza de uma
  // tarefa de mês que vem, e a de hoje é a única que ainda dá para cumprir.
  const nivel = urgenciaDaProximaAcao(task.due_at, agora)

  return (
    <span
      title={task.title}
      className={cn(
        'flex items-center gap-1 text-xs font-medium whitespace-nowrap',
        corDaUrgencia[nivel],
      )}
    >
      <Icone aria-hidden className="size-3" />
      {rotuloDePrazo(task.due_at, agora)}
    </span>
  )
}
