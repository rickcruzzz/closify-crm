'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MonthGrid } from '@/components/ui/month-grid'
import { diaEmSaoPaulo } from '@/lib/tasks/buckets'

/**
 * Seleção de intervalo de datas, visual, com destaque de range e preview de
 * hover — não dois `<input type="date">` desconectados.
 *
 * Desktop: dois meses lado a lado, o segundo sempre um mês à frente do
 * primeiro (não dois seletores independentes, senão a pessoa navegaria os
 * dois "meio a meio" tentando alinhar visualmente um intervalo).
 * Mobile: um mês por vez, dentro do espaço que o chamador fornece (o
 * `PeriodFilter` mobile embrulha isto num `Sheet` de baixo).
 *
 * A digitação manual (dois `<input type="date">`) continua existindo como
 * alternativa secundária, sempre visível, nunca escondida atrás de um passo
 * extra — mas o clique no calendário é a interação principal.
 */
export function DateRangePicker({
  desde,
  ate,
  onAplicar,
  onLimpar,
  className,
}: {
  desde: string | null
  ate: string | null
  onAplicar: (desde: string, ate: string) => void
  onLimpar: () => void
  className?: string
}) {
  const dosMeses = useMediaQuery('(min-width: 640px)')

  const hoje = React.useMemo(() => diaEmSaoPaulo(new Date()), [])
  const [anoBase, mesBase] = React.useMemo(() => {
    const [a, m] = (desde ?? hoje).split('-').map(Number) as [number, number]
    return [a, m]
  }, [desde, hoje])

  const [ano, setAno] = React.useState(anoBase)
  const [mes, setMes] = React.useState(mesBase)

  // Estado local de seleção: só vira o `desde`/`ate` de verdade quando a
  // pessoa aperta Aplicar. Clicar no calendário não navega a URL a cada
  // clique, só ao confirmar — mesmo motivo por trás do botão Aplicar
  // original, mantido aqui.
  const [inicioSelecao, setInicioSelecao] = React.useState<string | null>(desde)
  const [fimSelecao, setFimSelecao] = React.useState<string | null>(ate)
  const [diaEmHover, setDiaEmHover] = React.useState<string | null>(null)

  function navegarMes(direcao: -1 | 1) {
    const data = new Date(Date.UTC(ano, mes - 1 + direcao, 1))
    setAno(data.getUTCFullYear())
    setMes(data.getUTCMonth() + 1)
  }

  function clicarDia(dia: string) {
    // Sem início, ou intervalo já fechado (os dois já preenchidos): o clique
    // COMEÇA um novo intervalo — não dá pra "editar só o fim" clicando de
    // novo, senão o segundo clique ficaria ambíguo (édito o início ou o
    // fim?). É o padrão universal de range picker: clique novo sempre reabre.
    if (!inicioSelecao || (inicioSelecao && fimSelecao)) {
      setInicioSelecao(dia)
      setFimSelecao(null)
      return
    }

    // Segundo clique: fecha o intervalo, na ordem certa mesmo se a pessoa
    // clicou uma data ANTES do início por engano.
    if (dia < inicioSelecao) {
      setFimSelecao(inicioSelecao)
      setInicioSelecao(dia)
    } else {
      setFimSelecao(dia)
    }
  }

  function aplicar() {
    if (!inicioSelecao || !fimSelecao) return
    onAplicar(inicioSelecao, fimSelecao)
  }

  function limpar() {
    setInicioSelecao(null)
    setFimSelecao(null)
    onLimpar()
  }

  const segundoMes = React.useMemo(() => {
    const data = new Date(Date.UTC(ano, mes, 1))
    return { ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 }
  }, [ano, mes])

  const resumo =
    inicioSelecao && fimSelecao
      ? `${formatarCurto(inicioSelecao)} – ${formatarCurto(fimSelecao)}`
      : inicioSelecao
        ? `${formatarCurto(inicioSelecao)} – selecione o fim`
        : 'Selecione o início'

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className={cn('flex gap-4', dosMeses ? 'flex-row' : 'flex-col')}>
        <MonthGrid
          ano={ano}
          mes={mes}
          onNavegarMes={navegarMes}
          inicioSelecionado={inicioSelecao}
          fimSelecionado={fimSelecao}
          diaEmHover={diaEmHover}
          onDiaClick={clicarDia}
          onDiaHover={setDiaEmHover}
        />
        {dosMeses && (
          <MonthGrid
            ano={segundoMes.ano}
            mes={segundoMes.mes}
            // O segundo mês não navega sozinho: navegar o primeiro já avança
            // os dois juntos (ele é sempre "primeiro + 1"), navegar os dois
            // de forma independente reabriria o problema de dois seletores
            // desconectados que este componente existe para resolver.
            mostrarNavegacao={false}
            inicioSelecionado={inicioSelecao}
            fimSelecionado={fimSelecao}
            diaEmHover={diaEmHover}
            onDiaClick={clicarDia}
            onDiaHover={setDiaEmHover}
          />
        )}
      </div>

      {/* Resumo do período: some a ambiguidade de "o que exatamente eu
          escolhi" sem precisar decifrar o destaque visual sozinho. */}
      <p className="text-muted-foreground text-center text-sm" aria-live="polite">
        {resumo}
      </p>

      {/* Digitação manual, secundária: mesma interação de antes, mas junto
          do calendário visual, não em vez dele. As duas formas de entrada
          ficam sincronizadas pelo mesmo estado. */}
      <div className="flex flex-col gap-2 min-[420px]:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="periodo-desde-manual">De</Label>
          <Input
            id="periodo-desde-manual"
            type="date"
            value={inicioSelecao ?? ''}
            max={fimSelecao || undefined}
            onChange={(e) => setInicioSelecao(e.target.value || null)}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="periodo-ate-manual">Até</Label>
          <Input
            id="periodo-ate-manual"
            type="date"
            value={fimSelecao ?? ''}
            min={inicioSelecao || undefined}
            onChange={(e) => setFimSelecao(e.target.value || null)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={limpar}>
          Limpar
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!inicioSelecao || !fimSelecao}
          onClick={aplicar}
        >
          Aplicar
        </Button>
      </div>
    </div>
  )
}

function formatarCurto(diaYyyyMmDd: string): string {
  const [ano, mes, dia] = diaYyyyMmDd.split('-')
  return `${dia}/${mes}/${ano}`
}
