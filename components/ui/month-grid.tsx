'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  gradeDoMes,
  rotuloDoMes,
  NOMES_DOS_DIAS_DA_SEMANA,
  diaEstaNoIntervalo,
} from '@/lib/calendario/grade-do-mes'

/**
 * Um mês navegável, célula por dia, com seleção de intervalo.
 *
 * Base do range picker do filtro de período (`date-range-picker.tsx`, um ou
 * dois lado a lado) e do modo Mês do calendário (`month-view.tsx`, que passa
 * `renderizarDia` para desenhar chips de tarefa em vez de só o número).
 */
export function MonthGrid({
  ano,
  mes,
  onNavegarMes,
  inicioSelecionado,
  fimSelecionado,
  onDiaClick,
  onDiaHover,
  diaEmHover,
  mostrarNavegacao = true,
  renderizarDia,
  className,
}: {
  ano: number
  mes: number
  onNavegarMes?: (direcao: -1 | 1) => void
  inicioSelecionado?: string | null
  fimSelecionado?: string | null
  onDiaClick?: (dia: string) => void
  onDiaHover?: (dia: string | null) => void
  /** Só usado quando há início mas não fim: mostra o range em preview antes do 2º clique. */
  diaEmHover?: string | null
  mostrarNavegacao?: boolean
  /** Sobrepõe o conteúdo da célula (calendário de monitoramento usa para chips de tarefa). */
  renderizarDia?: (dia: string, numeroDoDia: number, ehDoMesCorrente: boolean) => React.ReactNode
  className?: string
}) {
  /**
   * O mesmo componente serve a dois usos com necessidades opostas.
   *
   * No range picker (sem `renderizarDia`) cada dia é um alvo de clique solto,
   * e linha divisória ali só faria ruído — é um seletor, não uma agenda.
   *
   * No calendário (com `renderizarDia`) o dia é uma ÁREA que recebe conteúdo.
   * Sem moldura, as células flutuam no vazio: os dias sem evento viram
   * números soltos no escuro e a semana perde a forma de linha. Toda agenda
   * de CRM sério (Pipedrive, HubSpot, Google Calendar) desenha essa moldura,
   * e é ela que faz a grade parecer produto em vez de esqueleto.
   */
  const ehAgenda = Boolean(renderizarDia)
  const celulas = React.useMemo(() => gradeDoMes(ano, mes), [ano, mes])

  // Enquanto só o início foi escolhido, o fim "temporário" é o dia em hover —
  // é isso que pinta o range antes do segundo clique confirmar.
  const fimEfetivo = fimSelecionado ?? (inicioSelecionado ? diaEmHover : null) ?? null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {mostrarNavegacao && (
        <div className="flex items-center justify-between px-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mês anterior"
            onClick={() => onNavegarMes?.(-1)}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <span className="text-sm font-medium">{rotuloDoMes(ano, mes)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Próximo mês"
            onClick={() => onNavegarMes?.(1)}
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      <div
        className={cn(
          'grid grid-cols-7 text-center',
          ehAgenda
            ? // Moldura única com divisórias internas: `divide-*` desenha as
              // linhas ENTRE as células sem somar borda dupla, e o `overflow`
              // faz o arredondamento valer para as células dos cantos.
              'border-border divide-border overflow-hidden rounded-lg border divide-x divide-y'
            : 'gap-y-1',
        )}
      >
        {NOMES_DOS_DIAS_DA_SEMANA.map((nome, indice) => (
          <span
            key={nome}
            className={cn(
              'text-muted-foreground text-xs font-medium',
              ehAgenda &&
                // Faixa de cabeçalho: o `tracking-wider` em maiúsculas separa
                // o rótulo do conteúdo sem precisar de mais uma linha.
                'bg-muted/40 px-2 py-2 text-[11px] tracking-wider uppercase',
              // Fim de semana já se distingue no cabeçalho, não só nas células.
              ehAgenda && (indice === 0 || indice === 6) && 'text-muted-foreground/70',
            )}
          >
            {nome}
          </span>
        ))}

        {celulas.map((celula, indice) => {
          const noIntervalo = diaEstaNoIntervalo(celula.dia, inicioSelecionado ?? null, fimEfetivo)
          const ehInicio = celula.dia === inicioSelecionado
          const ehFim = celula.dia === fimSelecionado

          if (renderizarDia) {
            const diaDaSemana = indice % 7
            return (
              <div
                key={celula.dia}
                className={cn(
                  'min-h-0',
                  // Sábado e domingo com um véu a mais: dá o ritmo da semana
                  // sem precisar de cor, e é o que faz o olho encontrar a
                  // linha certa de imediato.
                  (diaDaSemana === 0 || diaDaSemana === 6) && 'bg-muted/20',
                )}
              >
                {renderizarDia(celula.dia, celula.numeroDoDia, celula.ehDoMesCorrente)}
              </div>
            )
          }

          return (
            <button
              key={celula.dia}
              type="button"
              disabled={!celula.ehDoMesCorrente && !onDiaClick}
              // `min-h-11` (44px), mesmo piso de alvo de toque medido e
              // corrigido em `select.tsx`/`combobox.tsx` esta semana — um
              // calendário é o lugar onde errar o dia por um alvo pequeno
              // demais é mais caro (a pessoa erra a DATA, não só o clique).
              className={cn(
                'relative flex min-h-11 items-center justify-center rounded-md text-sm transition-colors md:min-h-9',
                celula.ehDoMesCorrente
                  ? 'text-foreground'
                  : 'text-muted-foreground/40',
                noIntervalo && !ehInicio && !ehFim && 'bg-primary/15',
                (ehInicio || ehFim) && 'bg-primary text-primary-foreground font-medium',
                !ehInicio && !ehFim && celula.ehDoMesCorrente && 'hover:bg-accent',
              )}
              onClick={() => onDiaClick?.(celula.dia)}
              onMouseEnter={() => onDiaHover?.(celula.dia)}
              onMouseLeave={() => onDiaHover?.(null)}
              aria-current={celula.dia === inicioSelecionado ? 'date' : undefined}
              aria-label={celula.dia}
            >
              {celula.numeroDoDia}
            </button>
          )
        })}
      </div>
    </div>
  )
}
