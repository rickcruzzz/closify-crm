import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Área de texto do projeto.
 *
 * `forwardRef` não é detalhe de implementação aqui — é o que faz o campo
 * FUNCIONAR. Sem ele, um componente de função descarta a `ref` em silêncio, e
 * `react-hook-form` registra o campo por ref: `{...register('corpo')}` passava
 * a ref para o nada, o formulário lia o valor como `undefined`, e o Zod v4
 * respondia com seu erro genérico — "Invalid input", em inglês, embaixo de um
 * campo visivelmente preenchido.
 *
 * Descoberto em 23/08 gravando o vídeo de verificação do Google: a tela de
 * enviar e-mail pelo Gmail nunca enviou nada. O `Input` irmão sempre teve
 * `forwardRef`, e é por isso que só os campos de textarea falhavam — o assunto
 * passava, a mensagem não.
 *
 * Três formulários dependiam disso: enviar e-mail (`corpo`), registrar
 * atividade (`description`) e a descrição da empresa. Nos dois últimos, onde o
 * schema aceita texto vazio, não havia erro nenhum na tela: o que a pessoa
 * digitava simplesmente não era gravado.
 *
 * Terceira exceção consciente à regra de não editar `components/ui` à mão
 * (depois do `Separator` e do `ComboboxInput`), pelo mesmo motivo: regenerar
 * pelo CLI traz o defeito de volta.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-20 w-full rounded-lg border bg-transparent px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:min-h-16 md:text-sm',
        className,
      )}
      {...props}
    />
  )
  },
)

export { Textarea }
