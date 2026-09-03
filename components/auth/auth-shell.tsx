import Link from 'next/link'

import { Logo } from '@/components/branding/logo'

/**
 * A casca das seis telas de estado do fluxo (confirmação, espera, erro,
 * boas-vindas, onboarding, recuperação de senha).
 *
 * Vive no `layout.tsx` do grupo `(transicao)`, não importada por cada página.
 * A diferença importa: o fallback de `<Suspense>` de um `loading.tsx` é
 * renderizado DENTRO do layout do segmento, então `bem-vindo/loading.tsx` e
 * `onboarding/loading.tsx` passam a nascer com logo e centralização de graça,
 * em vez de aparecerem como um cartão solto no canto da tela. E uma nona tela
 * criada amanhã não tem como esquecer a casca.
 *
 * O `<main id="conteudo">` NÃO está aqui: mora uma vez só no layout pai, para
 * o alvo do "pular para o conteúdo" não duplicar.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      {/* `py-1.5 -my-1.5` leva o lockup de 32px para 44px de alvo de toque sem
          deslocar nada: o padding cresce a caixa e a margem negativa devolve o
          espaço ao layout. */}
      <Link
        href="/"
        className="animate-entrada fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-1 focus-visible:ring-ring inline-flex w-fit -my-1.5 rounded-lg py-1.5 outline-none focus-visible:ring-3"
      >
        <Logo />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
