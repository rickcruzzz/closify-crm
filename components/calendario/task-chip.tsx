'use client'

import { cn } from '@/lib/utils'
import { iconePorTipo } from '@/lib/tasks/types'
import { corDaUrgencia, urgenciaDaProximaAcao } from '@/lib/kanban/urgencia'
import type { TaskRow } from '@/lib/tasks/types'

const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Uma tarefa como chip de linha, usado nas células do modo Mês e nas colunas
 * do modo Semana.
 *
 * ## Por que o nome do cliente vem primeiro
 *
 * A versão anterior mostrava só hora + título da tarefa, e o resultado na
 * tela era `09:00 yyuuuu` — o título é o que a pessoa digitou correndo
 * ("ligar", "retorno", ou pior), enquanto o NOME DO CLIENTE é o que ela
 * procura ao bater o olho na agenda.
 *
 * `lead_name` já vinha em `TaskRow` (resolvido em `enriquecer`, em
 * `lib/tasks/queries.ts`) e estava sendo descartado aqui — a informação mais
 * valiosa da linha chegava ao componente e era jogada fora.
 *
 * Ordem: cliente → hora → título como apoio. Sem cliente vinculado (tarefa
 * de negócio sem lead), o título assume o lugar principal em vez de deixar
 * um vazio.
 *
 * ## Cor
 *
 * Segue a MESMA regra de urgência que o Kanban e a tela /hoje já usam
 * (`lib/kanban/urgencia.ts`) — três lugares do produto não podem discordar
 * sobre o que é "atrasado" ou "hoje". Tarefa concluída nunca é `critico` nem
 * `atencao`: já aconteceu, cor neutra e texto riscado, não é mais uma
 * cobrança.
 */
export function TaskChip({
  task,
  agora,
  onClick,
}: {
  task: TaskRow
  agora: Date
  onClick: () => void
}) {
  const Icone = iconePorTipo[task.type]
  const concluida = Boolean(task.done_at)
  const urgencia = concluida ? 'neutro' : urgenciaDaProximaAcao(task.due_at, agora)
  const hora = horaFormatada.format(new Date(task.due_at))

  // Sem lead vinculado o título é tudo o que existe para identificar a
  // tarefa; com lead, ele vira apoio (o cliente é quem manda na linha).
  const principal = task.lead_name ?? task.title
  const apoio = task.lead_name ? task.title : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // `min-h-11` (44px) em mobile — mesmo piso de alvo de toque já
        // aplicado em select.tsx/combobox.tsx/month-grid.tsx — volta a
        // `min-h-6` (24px) a partir de `md:`, onde o toque é por mouse, para
        // não perder densidade na grade de mês em telas grandes.
        'hover:bg-accent flex min-h-11 w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs transition-colors md:min-h-6',
        corDaUrgencia[urgencia],
      )}
      // O `title` nativo carrega a linha inteira: na célula do mês o texto é
      // truncado, e é aqui que quem passa o mouse lê o resto.
      title={`${hora} · ${principal}${apoio ? ` — ${apoio}` : ''}`}
    >
      <Icone aria-hidden className="size-3 shrink-0" />
      {/* `tabular-nums` para as horas alinharem entre linhas da mesma célula:
          sem isso "09:00" e "11:30" saem com larguras diferentes e a coluna
          de nomes fica serrilhada. */}
      <span className="shrink-0 tabular-nums opacity-80">{hora}</span>
      <span className={cn('truncate font-medium', concluida && 'line-through opacity-70')}>
        {principal}
      </span>
      {apoio && (
        // Só aparece quando sobra espaço (célula do mês é estreita): some
        // primeiro que o nome do cliente, que é o que não pode faltar.
        <span className="hidden truncate opacity-60 lg:inline">{apoio}</span>
      )}
    </button>
  )
}
