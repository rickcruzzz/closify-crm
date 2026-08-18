'use client'

import * as React from 'react'
import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete'

import { cn } from '@/lib/utils'

/**
 * Campo de texto que sugere enquanto a pessoa digita.
 *
 * Vem de `@base-ui/react`, a mesma base do `Select` e do `Dialog` daqui, então
 * não há dependência nova: o teclado, o foco e o `aria` de combobox saem
 * prontos, que é justamente a parte que um autocomplete feito à mão erra.
 *
 * As classes do popup e do item são as do `components/ui/select.tsx`, copiadas
 * de propósito: sugestão e opção de select são a mesma coisa para quem olha, e
 * inventar um segundo visual de lista suspensa faria duas telas do produto
 * discordarem sobre o que é uma lista.
 */
const Autocomplete = AutocompletePrimitive.Root

const AutocompleteInput = AutocompletePrimitive.Input

function AutocompleteContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: AutocompletePrimitive.Popup.Props &
  Pick<AutocompletePrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'>) {
  return (
    <AutocompletePrimitive.Portal>
      <AutocompletePrimitive.Positioner sideOffset={sideOffset} className="isolate z-50">
        <AutocompletePrimitive.Popup
          data-slot="autocomplete-content"
          className={cn(
            'bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg p-1.5 shadow-[0_16px_40px_-8px_rgb(0_0_0/0.75),0_4px_12px_-4px_rgb(0_0_0/0.5)] ring-1 duration-100',
            className,
          )}
          {...props}
        >
          {children}
        </AutocompletePrimitive.Popup>
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  )
}

const AutocompleteList = AutocompletePrimitive.List

function AutocompleteItem({
  className,
  children,
  ...props
}: AutocompletePrimitive.Item.Props) {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      // `min-h-11` (44px) no toque: o item nasceu com 32px de altura, medido
      // no mobile, abaixo do mínimo de alvo de toque. No desktop volta a
      // `min-h-9`, onde o ponteiro é preciso e a lista densa lê melhor.
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex min-h-11 w-full cursor-default items-center gap-2 rounded-md px-1.5 py-1.5 text-sm outline-hidden select-none md:min-h-9 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </AutocompletePrimitive.Item>
  )
}

function AutocompleteEmpty({
  className,
  ...props
}: AutocompletePrimitive.Empty.Props) {
  return (
    <AutocompletePrimitive.Empty
      data-slot="autocomplete-empty"
      className={cn(
        'text-muted-foreground px-1.5 py-3 text-center text-sm empty:hidden',
        className,
      )}
      {...props}
    />
  )
}

export {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
}
