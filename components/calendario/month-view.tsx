'use client'

import { cn } from '@/lib/utils'
import { MonthGrid } from '@/components/ui/month-grid'
import { TaskChip } from '@/components/calendario/task-chip'
import { ordenarPorRelevancia } from '@/lib/calendario/ordenar-por-relevancia'
import { diaEmSaoPaulo } from '@/lib/tasks/buckets'
import type { TaskRow } from '@/lib/tasks/types'

/** Até quantos chips uma célula mostra antes de resumir em "+N". */
const MAX_CHIPS_POR_DIA = 3

export function MonthView({
  ano,
  mes,
  onNavegarMes,
  tarefasPorDia,
  agora,
  onSelecionarTarefa,
  onVerMais,
}: {
  ano: number
  mes: number
  onNavegarMes: (direcao: -1 | 1) => void
  tarefasPorDia: Map<string, TaskRow[]>
  agora: Date
  onSelecionarTarefa: (task: TaskRow) => void
  /** Clicar num dia com mais itens do que cabe abre a Semana ancorada nele. */
  onVerMais: (dia: string) => void
}) {
  const hoje = diaEmSaoPaulo(agora)

  return (
    <MonthGrid
      ano={ano}
      mes={mes}
      onNavegarMes={onNavegarMes}
      // O cabeçalho de navegação (mês + setas) já é desenhado por
      // `calendario-client.tsx`, mesmo elemento reusado pelo modo Semana —
      // dois cabeçalhos duplicados aqui, achado testando visualmente.
      mostrarNavegacao={false}
      renderizarDia={(dia, numeroDoDia, ehDoMesCorrente) => {
        // Ordenar ANTES de fatiar. O `Map` vem em ordem cronológica pura, e
        // cronológico não sabe o que já foi feito: um dia com três tarefas
        // concluídas de manhã e uma vencida à tarde gastava os três chips com
        // as concluídas e escondia a vencida atrás do "+1" — a tela que existe
        // para lembrar mostrava o que acabou e ocultava o que cobra ação.
        const tarefas = ordenarPorRelevancia(tarefasPorDia.get(dia) ?? [], agora)
        const visiveis = tarefas.slice(0, MAX_CHIPS_POR_DIA)
        const resto = tarefas.length - visiveis.length

        return (
          <div
            className={cn(
              // Sem borda própria: a moldura e as divisórias agora são
              // desenhadas pelo `MonthGrid` (`divide-*`), e repetir aqui
              // daria linha dupla em toda célula.
              //
              // `min-h-28` porque o chip tem duas linhas (hora em cima,
              // cliente embaixo) — a altura anterior apertava três deles.
              'hover:bg-accent/40 flex min-h-28 flex-col gap-1 p-1.5 transition-colors',
              dia === hoje && 'bg-primary/[0.07]',
              // Dia de outro mês fica presente mas claramente fora: some por
              // opacidade, não por cor, para o número continuar legível a
              // quem precisa dele.
              !ehDoMesCorrente && 'opacity-35',
            )}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center self-start rounded-full text-xs leading-none tabular-nums',
                dia === hoje
                  ? // Marcador redondo preenchido é a convenção de agenda
                    // (Google Calendar, Outlook, Pipedrive): a data de hoje
                    // se encontra num relance, sem precisar caçar cor de
                    // texto no meio dos eventos.
                    'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground font-medium',
              )}
            >
              {numeroDoDia}
            </span>
            {visiveis.map((task) => (
              <TaskChip
                key={task.id}
                task={task}
                agora={agora}
                onClick={() => onSelecionarTarefa(task)}
              />
            ))}
            {resto > 0 && (
              // "+1" sozinho não é rótulo de botão: não diz o que acontece ao
              // clicar nem o que está escondido. O texto visível ganha a
              // palavra, e o `aria-label` diz o dia — na célula do calendário
              // o número do dia está noutro elemento, então quem navega por
              // leitor de tela ouviria "mais 1" sem saber de quando.
              <button
                type="button"
                onClick={() => onVerMais(dia)}
                aria-label={`Ver as ${tarefas.length} tarefas do dia ${numeroDoDia}`}
                className="text-muted-foreground hover:text-foreground flex min-h-11 items-center px-1 text-left text-xs transition-colors md:min-h-0"
              >
                +{resto} mais
              </button>
            )}
          </div>
        )
      }}
    />
  )
}
