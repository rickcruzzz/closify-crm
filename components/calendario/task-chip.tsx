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
 * Uma tarefa como chip, usado nas células do modo Mês e nas colunas do Semana.
 *
 * ## Duas linhas, não uma
 *
 * A célula do mês tem cerca de 100px úteis. A primeira tentativa punha ícone,
 * hora, nome e título na MESMA linha, e o resultado medido em produção foi
 * `09:00 Cl… t` — o nome do cliente, que é a informação que a tela existe
 * para dar, cortado em duas letras.
 *
 * Empilhado, cada coisa tem a largura inteira: a hora na linha de cima (com o
 * ícone do tipo) e o nome embaixo, em destaque. Custa altura, e é o troco
 * certo — uma agenda que não deixa reconhecer o cliente não está economizando
 * espaço, está desperdiçando a tela toda.
 *
 * O título da tarefa sai do chip de propósito. Ele é o que a pessoa digitou
 * correndo ("ligar", "retorno", "yyuuuu"), quase nunca ajuda a identificar, e
 * era justamente ele que empurrava o nome para fora. Continua acessível no
 * `title` nativo (hover) e no painel que abre ao clicar.
 *
 * ## Cor
 *
 * Segue a MESMA regra de urgência do Kanban e da tela /hoje
 * (`lib/kanban/urgencia.ts`) — três lugares do produto não podem discordar
 * sobre o que é "atrasado". Concluída nunca é `critico` nem `atencao`: já
 * aconteceu, cor neutra e riscada, não é mais cobrança.
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

  // Sem lead vinculado (tarefa de negócio solto) o título é tudo o que existe
  // para identificar a linha — aí ele assume o lugar do nome em vez de deixar
  // um vazio.
  const principal = task.lead_name ?? task.title

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Fundo próprio, não só texto solto: dentro de uma célula com moldura
        // o evento precisa ler como um objeto pousado ali, senão vira texto
        // perdido no meio do vazio.
        //
        // A faixa de cor fica na borda esquerda — dá o estado
        // (atrasado / hoje / futuro) sem tingir o texto inteiro, que era o
        // que deixava a grade toda gritando em vermelho.
        'flex w-full flex-col gap-0.5 rounded-[5px] border-l-2 py-1 pr-1 pl-1.5 text-left transition-colors',
        urgencia === 'critico'
          ? 'border-l-destructive bg-destructive/10 hover:bg-destructive/15'
          : urgencia === 'atencao'
            ? 'border-l-amber-500 bg-amber-500/10 hover:bg-amber-500/15'
            : 'border-l-primary/50 bg-muted/60 hover:bg-muted',
      )}
      // O título completo mora aqui: some do chip, mas quem passa o mouse lê.
      title={`${hora} · ${principal}${task.lead_name ? ` — ${task.title}` : ''}`}
    >
      <span
        className={cn(
          'flex items-center gap-1 text-[11px] leading-none font-medium',
          corDaUrgencia[urgencia],
        )}
      >
        <Icone aria-hidden className="size-3 shrink-0" />
        {/* `tabular-nums` para as horas alinharem entre as linhas da célula:
            sem isso "09:00" e "11:30" saem com larguras diferentes. */}
        <span className="tabular-nums">{hora}</span>
      </span>
      <span
        className={cn(
          'text-foreground truncate text-xs leading-tight font-medium',
          concluida && 'text-muted-foreground line-through',
        )}
      >
        {principal}
      </span>
    </button>
  )
}
