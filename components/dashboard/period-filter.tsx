'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CalendarRange, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useMediaQuery } from '@/hooks/use-media-query'
import { rotuloDoPreset, ordemDosPresets, type PresetDePeriodo } from '@/lib/dashboard/periodo'

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
  const [painelAberto, setPainelAberto] = React.useState(false)
  const ehMobile = !useMediaQuery('(min-width: 640px)')

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
    setPainelAberto(false)
    navegar(params)
  }

  function aplicarPersonalizado(desde: string, ate: string) {
    const params = new URLSearchParams(searchParams)
    params.delete('periodo')
    params.set('desde', desde)
    params.set('ate', ate)
    setPainelAberto(false)
    navegar(params)
  }

  const conteudoDoPicker = (
    <DateRangePicker
      desde={desdeAtivo}
      ate={ateAtivo}
      onAplicar={aplicarPersonalizado}
      onLimpar={limpar}
    />
  )

  const rotuloBotao = personalizado
    ? `${formatarCurto(desdeAtivo)} – ${formatarCurto(ateAtivo)}`
    : 'Personalizado'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ordemDosPresets.map((preset) => (
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

      {ehMobile ? (
        <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
          <Button
            type="button"
            size="sm"
            variant={personalizado ? 'default' : 'outline'}
            disabled={pending}
            onClick={() => setPainelAberto(true)}
          >
            <CalendarRange className="size-4" />
            {rotuloBotao}
          </Button>
          {/* `side="bottom"`: bottom sheet no mobile, não popover comprimido
              tentando caber um calendário — mesma diretriz que a skill
              ui-ux-pro-max marca para seleção de data em telas pequenas. */}
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Período personalizado</SheetTitle>
              <SheetDescription>Escolha o início e o fim do intervalo.</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4">{conteudoDoPicker}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <DropdownMenu open={painelAberto} onOpenChange={setPainelAberto}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant={personalizado ? 'default' : 'outline'}
                disabled={pending}
              />
            }
          >
            <CalendarRange className="size-4" />
            {rotuloBotao}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto p-4">
            {conteudoDoPicker}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

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
