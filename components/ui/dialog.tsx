'use client'

import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { XIcon } from 'lucide-react'

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      {/* `max-h-[calc(100dvh-2rem)] overflow-y-auto` conserta um defeito que
          atingia os quinze diálogos do produto, não só um.

          O popup é `fixed top-1/2 -translate-y-1/2`, ou seja, centralizado. Sem
          teto de altura, conteúdo mais alto que a janela transborda METADE para
          cima e metade para baixo, e a metade de cima fica INALCANÇÁVEL:
          `position: fixed` não acompanha a rolagem da página, e sem
          `overflow-y-auto` também não existe barra interna. Medido em produção
          com o diálogo de importar CSV: em 1366x768 sumiam 79px em cada ponta,
          em 390x844 sumiam 97px, e o corte simétrico é a assinatura do
          centramento. Abaixo de ~890px de altura de janela já cortava, e 768px
          é a tela mais comum do público.

          `dvh` e não `vh` de propósito: no celular a barra do navegador entra e
          sai, e `vh` mede a janela como se ela não existisse, justamente o caso
          onde o corte era maior.

          O `-2rem` deixa a mesma folga lateral que o `max-w-[calc(100%-2rem)]`
          já usava, para o diálogo não encostar na borda da tela.

          `grid-cols-[minmax(0,1fr)]` conserta o corte LATERAL, irmão do de
          cima e igualmente geral. A faixa implícita de um grid é
          `minmax(auto, 1fr)`, e esse `auto` obedece ao CONTEÚDO mais largo,
          não ao contêiner: medido a 291px de janela, com `clientWidth` de
          259px, a coluna resolvia em 327px e todo filho herdava. O rodapé
          chegava a 359px, somando as margens negativas `-mx-4`, e o botão de
          confirmar ficava fora da tela — sem barra para alcançá-lo, porque um
          `overflow-x` não desfaz uma coluna que o grid já decidiu larga.
          Medido a 291px: 359px de `scrollWidth` antes, 259px depois, que é
          exatamente a largura útil. Aparecia primeiro no diálogo de tarefa
          porque ele é o que usa `sm:grid-cols-2` (vira coluna única no
          estreito); os outros usam `grid-cols-2` fixo e escapavam por sorte do
          conteúdo, não por estarem certos. */}
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl p-4 text-sm ring-1 duration-100 outline-none sm:max-w-sm',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />
            }
          >
            <XIcon />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'bg-muted/50 -mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t p-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-heading text-base leading-none font-medium', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3',
        className,
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
