import type { Metadata } from 'next'

import { SignUpForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Criar conta',
  description:
    'Crie sua conta no Velo Funil e comece a organizar seu funil de vendas. Plano gratuito, sem cartão.',
  alternates: { canonical: '/cadastro' },
}

/**
 * Server Component: lê a querystring e entrega o formulário pronto no HTML.
 *
 * ## O que isto conserta
 *
 * A página inteira era `'use client'` e lia a intenção por `useSearchParams`.
 * Esse hook marca a árvore como dinâmica e obriga uma fronteira de Suspense —
 * e como a fronteira envolvia a página toda, o HTML servido em `/cadastro`
 * continha apenas o esqueleto do fallback. Nenhum campo, nenhum botão.
 *
 * Isso custava em duas frentes ao mesmo tempo. Para o buscador, a página pede
 * indexação (`canonical` acima) e entregava uma tela vazia. Para quem chega de
 * anúncio com rede ruim, a tela de criar conta — o funil inteiro de aquisição
 * paga — só existia depois de o JavaScript baixar e executar.
 *
 * `searchParams` chega pronto do Next, sem hook e sem custo: é a mesma
 * informação, lida do lado que não precisa de JavaScript para lê-la.
 *
 * ## Efeito colateral bom
 *
 * O `layout.tsx` que existia nesta pasta só para carregar a metadata (client
 * component não pode exportá-la) deixou de ser necessário e foi removido — a
 * metadata voltou para a própria página, que é onde se procura por ela.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string; plano?: string; email?: string }>
}) {
  const params = await searchParams

  return (
    <SignUpForm
      convite={params.convite}
      // Só `'pro'` é aceito: qualquer outro valor na URL é ignorado em vez de
      // seguir para a Server Action, que grava isso num cookie de intenção.
      plano={params.plano === 'pro' ? 'pro' : undefined}
      emailConvidado={params.email ?? ''}
    />
  )
}
