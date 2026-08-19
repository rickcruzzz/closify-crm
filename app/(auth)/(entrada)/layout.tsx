import { AuthSplit } from '@/components/auth/auth-split'

/**
 * As duas telas de entrada (login e cadastro) em tela dividida.
 *
 * Route group: os parênteses não entram na URL, então `/login` e `/cadastro`
 * seguem exatamente onde estavam — o `matcher` do `middleware.ts` e todos os
 * `redirect()` do projeto continuam válidos sem edição.
 */
export default function EntradaLayout({ children }: { children: React.ReactNode }) {
  return <AuthSplit>{children}</AuthSplit>
}
