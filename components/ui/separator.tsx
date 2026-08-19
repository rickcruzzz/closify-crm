'use client'

import { Separator as SeparatorPrimitive } from '@base-ui/react/separator'

import { cn } from '@/lib/utils'

function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        // `data-[orientation=horizontal]`, não `data-horizontal`: o primitivo
        // do Base UI emite `data-orientation="horizontal"`, enquanto a variante
        // `data-horizontal:` do Tailwind gera o seletor `[data-horizontal]`,
        // que procura um atributo com esse nome — e ele nunca existiu. O CSS
        // saía correto (`[data-horizontal]{height:1px}`), simplesmente não
        // casava com nada, então o separador ficava com altura 0: invisível.
        //
        // Efeito medido: os divisores "ou" de login e cadastro apareciam com o
        // texto solto, sem as linhas dos lados, e o separador do painel de
        // negócio no Kanban não desenhava. Nada quebrava, nada avisava.
        //
        // Exceção consciente à regra de não editar `components/ui` à mão: um
        // seletor que não casa não se conserta pelo CLI, e regenerar o arquivo
        // traria o mesmo defeito de volta.
        'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
