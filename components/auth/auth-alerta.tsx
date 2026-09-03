import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * A faixa de mensagem que aparece acima dos formulários de autenticação.
 *
 * A mesma marcação estava copiada em cinco arquivos. Não é só repetição: o
 * `role="alert"` é o que faz o leitor de tela anunciar a falha sem a pessoa
 * precisar navegar até lá, e regra de acessibilidade replicada à mão é regra
 * que uma tela nova esquece.
 *
 * Recebe `children` e não uma prop `mensagem` porque o erro do login não é
 * texto puro: ele carrega duas saídas dentro ("Criar conta" e "Recuperar
 * acesso"), que existem porque o login não revela se a conta existe, então a
 * mensagem precisa oferecer os dois caminhos em vez de acusar qual deles é o
 * certo.
 *
 * Entra com `duration-micro` e sem `delay-*`: o stagger da página é para o
 * carregamento, e este bloco aparece depois de um clique, quando a pessoa já
 * está olhando para o formulário. Atraso aqui seria latência percebida.
 */
const alertaVariants = cva('rounded-md px-3 py-2 text-sm', {
  variants: {
    tom: {
      erro: 'bg-destructive/10 text-destructive',
      sucesso: 'bg-primary/10 text-primary',
      neutro: 'bg-muted text-muted-foreground',
    },
  },
  defaultVariants: { tom: 'erro' },
})

export function AuthAlerta({
  tom,
  className,
  children,
}: VariantProps<typeof alertaVariants> & {
  className?: string
  children: React.ReactNode
}) {
  return (
    <p
      // `alert` só para o que é falha. Sucesso e aviso neutro usam `status`,
      // que anuncia sem interromper o que o leitor de tela estiver falando.
      role={tom === 'erro' || tom == null ? 'alert' : 'status'}
      className={cn(
        alertaVariants({ tom }),
        'animate-entrada fade-in slide-in-from-top-1 ease-entrada duration-micro',
        className,
      )}
    >
      {children}
    </p>
  )
}
