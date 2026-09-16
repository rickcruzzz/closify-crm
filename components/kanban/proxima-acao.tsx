'use client'

import * as React from 'react'
import { CircleAlert, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { dataExataCurta } from '@/lib/kanban/data-exata'
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
  etapaFechada = false,
  sabemosAData = true,
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
  /**
   * Se o negócio está em `fechado_ganho` ou `fechado_perdido`.
   *
   * Entrou em 16/09 fechando um alarme FALSO: `estadoDeMovimento` guarda
   * `dias` mesmo em etapa fechada, de propósito, e o card repassava o número
   * cru. Um negócio GANHO há 400 dias exibia `CircleAlert` vermelho pedindo o
   * próximo passo — e as fechadas são "as que mais acumulam linha".
   *
   * Quem decide é `etapaFechada` de `lib/deals/parado.ts`, nunca uma segunda
   * lista de etapas escrita aqui: duas listas divergem, e a que diverge em
   * silêncio é a copiada.
   */
  etapaFechada?: boolean
  /**
   * Se o relógio do cliente já chegou.
   *
   * `false` no primeiro quadro, porque o servidor roda em UTC e erraria a
   * virada do dia em São Paulo. Sem isto, `diasParado` caía no padrão `0`,
   * todo card sem tarefa nascia ÂMBAR e virava vermelho na hidratação: uma
   * piscada de cor no board inteiro.
   */
  sabemosAData?: boolean
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

  const urgencia = urgenciaSemProximaAcao(diasParado, { etapaFechada, sabemosAData })

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
          'focus-visible:ring-ring/50 -my-1 flex min-h-11 items-center gap-1 rounded-sm px-1 py-1 text-xs font-medium whitespace-nowrap outline-none hover:underline focus-visible:ring-3 md:min-h-6',
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
          <Plus aria-hidden className="size-3" />
        )}
        {/* ## O texto muda com o nível, e é a correção mais importante daqui

            "Sem próximo passo" é um JULGAMENTO, e ele aparecia em **34 dos 42
            cards do board de prova, 81%**. Algo que é verdade em oito de cada
            dez cards não é sinal: é o fundo. E escrito em âmbar, ele pintava
            de alerta a maior parte da tela — o mesmo defeito que
            `lib/kanban/urgencia.ts` nasceu para resolver, um degrau mais
            baixo de intensidade.

            Quando não há alarme, o card passa a oferecer a AÇÃO: "Marcar
            próximo passo" é o que o clique faz, é lido como afordância e não
            como acusação, e some do radar visual porque vem em `neutro`.

            O julgamento fica reservado para `critico`, que é parado E sem
            próximo passo — dois sinais na mesma direção. Aí a frase volta a
            ser exceção, que é quando ela funciona. */}
        {urgencia === 'critico' ? 'Sem próximo passo' : 'Marcar próximo passo'}
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

  const quando = dataExataCurta(task.due_at)
  const vencida = nivel === 'critico'

  return (
    <span
      title={task.title}
      className={cn(
        'flex min-w-0 items-center gap-1 text-xs font-medium',
        corDaUrgencia[nivel],
      )}
    >
      <Icone aria-hidden className="size-3 shrink-0" />
      {/* ## A DATA, e não "hoje", "amanhã", "em 3 dias"

          Pedido do dono em 16/09. `rotuloDePrazo` continua existindo e
          continua sendo usada por `/hoje` e `/calendario` — ali ela está
          certa, porque aquelas telas JÁ estão organizadas por dia e o
          relativo não obriga ninguém a converter nada.

          No card do funil é o contrário: a pessoa está montando o dia dela e
          precisa do horário para agendar. Por isso o Kanban formata por conta
          própria em vez de a função compartilhada mudar de comportamento para
          as três telas.

          "Vencido" no fim, e não no lugar da data: o estado é adjetivo do
          prazo, não substituto dele. Quem vê "12 abr • dom • 09:00 • Vencido"
          sabe o quanto atrasou sem a tela ter que contar.

          O nível de urgência que pinta isto NÃO mudou: quem decide continua
          sendo `urgenciaDaProximaAcao`, com o relógio do cliente. */}
      <span className="truncate">
        {quando ?? task.title}
        {vencida && quando && ' • Vencido'}
      </span>
    </span>
  )
}
