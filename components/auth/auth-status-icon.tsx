import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * O quadrado de ícone que abre as telas de estado do fluxo de autenticação.
 *
 * Existia em seis telas como marcação copiada, com QUATRO fundos diferentes
 * para três significados: `bg-primary/10` em verifique-email e no sucesso do
 * reset, `bg-primary` sólido em esqueci-senha e boas-vindas, `bg-emerald-500/10`
 * no sucesso da confirmação, `bg-destructive/10` nos erros. Duas telas de
 * sucesso do mesmo fluxo não podiam discordar sobre a cor de sucesso.
 *
 * Sucesso passou a ser `primary`, não emerald. O `globals.css` documenta que
 * só `--primary` e `--ring` carregam cor neste tema, o resto acromático de
 * propósito, e os valores de contraste foram calibrados contra WCAG. Emerald
 * era um segundo matiz que ninguém mediu, e o ícone (`CheckCircle2`,
 * `PartyPopper`) já carrega o significado sem depender de cor.
 *
 * `size-10` com ícone `size-5` deixa o bloco irmão do `Logo` (`size-8`), que
 * aparece logo acima na mesma coluna: tamanhos próximos leem como família, um
 * salto grande leria como elemento estranho.
 */
const statusIconVariants = cva(
  'flex size-10 shrink-0 items-center justify-center rounded-lg ring-1',
  {
    variants: {
      tom: {
        marca: 'bg-primary/10 text-primary ring-primary/20',
        erro: 'bg-destructive/10 text-destructive ring-destructive/20',
        neutro: 'bg-muted text-muted-foreground ring-border',
      },
    },
    defaultVariants: { tom: 'marca' },
  },
)

export function AuthStatusIcon({
  tom,
  className,
  children,
}: VariantProps<typeof statusIconVariants> & {
  className?: string
  /** O ícone, já dimensionado em `size-5` pelo chamador. */
  children: React.ReactNode
}) {
  return (
    <div aria-hidden className={cn(statusIconVariants({ tom }), className)}>
      {children}
    </div>
  )
}
