'use client'

import * as React from 'react'
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { ChevronDownIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Como o `Select`, mas com busca: fecha mostrando o item escolhido, abre com
 * um campo de texto que filtra a lista. Serve onde a lista é longa demais
 * para rolar procurando um nome — o `Select` comum não filtra nada.
 *
 * Diferente do `Autocomplete` (`components/ui/autocomplete.tsx`), cujo
 * `value` é o TEXTO digitado (bom para busca livre, como a do Pipeline): aqui
 * `value` é o ITEM selecionado, como um `Select` — o caso de vincular um
 * registro a um formulário, onde só a escolha final importa.
 *
 * Vem de `@base-ui/react`, a mesma base do `Select`/`Autocomplete`/`Dialog`
 * daqui: sem dependência nova. As classes do popup e do item são as mesmas do
 * `Select` e do `Autocomplete`, de propósito — as três listas suspensas do
 * produto não podem discordar sobre o que é uma lista.
 */
const Combobox = ComboboxPrimitive.Root

const ComboboxValue = ComboboxPrimitive.Value

function ComboboxTrigger({
  className,
  size = 'default',
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props & {
  size?: 'sm' | 'default'
}) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      data-size={size}
      className={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex w-full items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-11 data-[size=sm]:h-9 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=combobox-value]:line-clamp-1 *:data-[slot=combobox-value]:flex *:data-[slot=combobox-value]:items-center *:data-[slot=combobox-value]:gap-1.5 md:data-[size=default]:h-10 md:data-[size=sm]:h-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon aria-hidden className="text-muted-foreground size-4" />
    </ComboboxPrimitive.Trigger>
  )
}

// Campo de texto que aparece dentro do popup, para filtrar a lista já aberta
// — diferente do `Trigger`, que é o botão fechado mostrando o item escolhido.
/**
 * Campo de busca do combobox.
 *
 * Exceção consciente à regra de não editar `components/ui` à mão — a mesma do
 * `Separator`, e pelo mesmo motivo: regenerar pelo CLI traz o defeito de volta.
 *
 * O primitivo do Base UI vem **sem uma classe sequer**, então herdava o estilo
 * padrão do navegador: caixa branca de borda grossa dentro de um popup escuro.
 * Aparecia num print do produto como se fosse defeito de renderização.
 *
 * O estilo é o de campo de busca no topo de lista, não o de input de
 * formulário: sem borda ao redor (o popup já delimita), só uma divisória
 * embaixo separando da lista, e fundo transparente. `h-11` no telefone pela
 * regra de alvo de toque de 44px que o resto do projeto segue, `md:h-10` no
 * desktop, onde o alvo é o ponteiro.
 */
function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        'border-border placeholder:text-muted-foreground text-foreground h-11 w-full border-0 border-b bg-transparent px-3 text-base outline-none md:h-10 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

function ComboboxContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner sideOffset={sideOffset} className="isolate z-50">
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            'bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 relative isolate z-50 flex max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) flex-col overflow-hidden rounded-lg shadow-[0_16px_40px_-8px_rgb(0_0_0/0.75),0_4px_12px_-4px_rgb(0_0_0/0.5)] ring-1 duration-100',
            className,
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

const ComboboxList = ComboboxPrimitive.List

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      // `min-h-11` (44px) no toque, mesma correção medida no `Autocomplete`.
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex min-h-11 w-full cursor-default items-center gap-2 rounded-md px-1.5 py-1.5 text-sm outline-hidden select-none md:min-h-9 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </ComboboxPrimitive.Item>
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        'text-muted-foreground px-1.5 py-3 text-center text-sm empty:hidden',
        className,
      )}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
}
