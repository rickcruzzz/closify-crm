'use client'

import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { useSessaoAtiva } from '@/hooks/use-sessao-ativa'
import { cn } from '@/lib/utils'

/**
 * O botão de um plano, que muda de destino conforme exista sessão.
 *
 * ## O defeito que isto conserta
 *
 * O CTA do Pro apontava para `/cadastro?plano=pro` para todo mundo. Só que o
 * `middleware.ts` desvia quem TEM sessão de `/cadastro` para `/dashboard`:
 * quem já tinha criado a conta grátis clicava em "Começar com o Pro" e caía no
 * painel, sem passar por pagamento nenhum.
 *
 * É a mesma classe do "Assinar Pro" corrigido em 02/09 — rótulo que promete uma
 * coisa e clique que faz outra. Só que pior, porque aqui a pessoa já decidiu
 * pagar: é o único momento do funil em que ela está com o cartão na mão.
 *
 * ## Por que um componente separado
 *
 * `pricing-section.tsx` é Server Component e precisa continuar sendo — a landing
 * é o LCP da página que recebe tráfego pago, e torná-la dinâmica para ler sessão
 * no servidor custaria o TTFB de todo visitante para mudar o rótulo de um botão
 * que a quase totalidade deles nunca vê diferente.
 *
 * Mesmo padrão de `public-navbar.tsx`, que troca "Entrar" por "Ir para o
 * sistema": o padrão renderizado é o de quem está DESLOGADO, que é o caso de
 * quase todo mundo, e só quem tem sessão vê a troca depois da hidratação.
 *
 * ## O destino de quem está logado, e por que ele é seguro nos três estados
 *
 * `?assinar=1` abre o diálogo de CPF/CNPJ e cria a cobrança. Conferido nos três
 * estados possíveis de quem tem sessão, e nenhum vira caminho morto:
 *
 *     Free + admin    o diálogo abre, que é o caso do pedido
 *     Free + membro   "Peça a um administrador" (`plan-card.tsx`)
 *     já é Pro        o bloco inteiro não renderiza, porque vive dentro de
 *                     `plan === 'free'` — nenhum diálogo abre
 *
 * E se o cookie estiver velho, a presença dele não prova que o token vale: quem
 * valida é o `middleware.ts`, que manda para `/login`. A falha é segura.
 */
export function CtaDoPlano({
  hrefDeslogado,
  textoDeslogado,
  hrefLogado,
  textoLogado,
  variant = 'default',
  className,
}: {
  hrefDeslogado: string
  textoDeslogado: string
  /** Quando ausente, o botão não muda com a sessão — é o caso do Free. */
  hrefLogado?: string
  textoLogado?: string
  variant?: 'default' | 'outline'
  /**
   * As classes vêm do pai, e não são recalculadas aqui.
   *
   * A regra do `mt-auto` depende de o cartão ter ou não a frase de fecho, e ela
   * já vive em `pricing-section.tsx`. Duplicá-la aqui daria dois lugares para
   * manter alinhados — que é o defeito que esta rodada inteira está corrigindo
   * na descrição dos planos.
   */
  className?: string
}) {
  const logado = useSessaoAtiva()
  const mudaComSessao = logado && hrefLogado && textoLogado

  return (
    <Link
      href={mudaComSessao ? hrefLogado : hrefDeslogado}
      className={cn(buttonVariants({ variant }), className)}
    >
      {mudaComSessao ? textoLogado : textoDeslogado}
    </Link>
  )
}
