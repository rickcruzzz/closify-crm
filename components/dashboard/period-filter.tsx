'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CalendarRange, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { rotuloDoPreset, type PresetDePeriodo } from '@/lib/dashboard/periodo'

const PRESETS: PresetDePeriodo[] = ['7d', '30d', 'mes', 'ano']

// `YYYY-MM-DD` direto pra `DD/MM/YYYY` sem passar por `Date`, `new
// Date('2026-01-01')` é meia-noite UTC, e formatar isso no navegador de
// alguém num fuso negativo (Brasil) pode voltar um dia. String pura não tem
// esse risco.
function formatarCurto(diaYyyyMmDd: string): string {
  const [ano, mes, dia] = diaYyyyMmDd.split('-')
  return `${dia}/${mes}/${ano}`
}

export function PeriodFilter({
  presetAtivo,
  desdeAtivo,
  ateAtivo,
}: {
  presetAtivo: string | null
  desdeAtivo: string | null
  ateAtivo: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()
  const [popoverAberto, setPopoverAberto] = React.useState(false)
  const [desde, setDesde] = React.useState(desdeAtivo ?? '')
  const [ate, setAte] = React.useState(ateAtivo ?? '')

  const personalizado = !!(desdeAtivo && ateAtivo)
  const semFiltro = !presetAtivo && !personalizado

  function navegar(params: URLSearchParams) {
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function escolherPreset(preset: PresetDePeriodo) {
    const params = new URLSearchParams(searchParams)
    params.set('periodo', preset)
    params.delete('desde')
    params.delete('ate')
    navegar(params)
  }

  function limpar() {
    const params = new URLSearchParams(searchParams)
    params.delete('periodo')
    params.delete('desde')
    params.delete('ate')
    navegar(params)
  }

  function aplicarPersonalizado(e: React.FormEvent) {
    e.preventDefault()
    if (!desde || !ate) return
    const params = new URLSearchParams(searchParams)
    params.delete('periodo')
    params.set('desde', desde)
    params.set('ate', ate)
    setPopoverAberto(false)
    navegar(params)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset}
          type="button"
          size="sm"
          variant={presetAtivo === preset ? 'default' : 'outline'}
          disabled={pending}
          onClick={() => escolherPreset(preset)}
        >
          {rotuloDoPreset[preset]}
        </Button>
      ))}

      <DropdownMenu open={popoverAberto} onOpenChange={setPopoverAberto}>
        <DropdownMenuTrigger
          render={
            <Button type="button" size="sm" variant={personalizado ? 'default' : 'outline'} disabled={pending} />
          }
        >
          <CalendarRange className="size-4" />
          {personalizado ? `${formatarCurto(desdeAtivo)} – ${formatarCurto(ateAtivo)}` : 'Período personalizado'}
        </DropdownMenuTrigger>
        {/* `min-w` em vez de `w` fixo: nunca fica mais estreito que o
            necessário pros dois campos de data, mas pode crescer. `max-w`
            com `calc(100vw...)` é o teto de segurança, não importa quanto o
            cálculo de "espaço disponível" do popup decidir (a coluna
            principal do layout tem overflow-y-auto, e por regra da própria
            especificação CSS isso faz o eixo X também virar não-visible,
            então o popup pode calcular a largura livre com base na coluna,
            não na tela inteira), o popup nunca estoura o viewport. */}
        <DropdownMenuContent
          align="start"
          className="w-72 min-w-72 max-w-[calc(100vw-2rem)] p-3"
        >
          <form onSubmit={aplicarPersonalizado} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor="periodo-desde">De</Label>
                <Input
                  id="periodo-desde"
                  type="date"
                  value={desde}
                  max={ate || undefined}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor="periodo-ate">Até</Label>
                <Input
                  id="periodo-ate"
                  type="date"
                  value={ate}
                  min={desde || undefined}
                  onChange={(e) => setAte(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={!desde || !ate}>
              Aplicar
            </Button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      {!semFiltro && (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={limpar}>
          <X className="size-4" />
          Limpar
        </Button>
      )}

      {pending && <Loader2 aria-hidden className="text-muted-foreground size-4 animate-spin" />}
    </div>
  )
}
