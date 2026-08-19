import { Loader2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

/**
 * A tela de espera do fluxo de autenticação.
 *
 * Estava copiada em quatro lugares: o fallback de `<Suspense>` do
 * redefinir-senha, o fallback e o estado `confirmando` do confirmar, e os dois
 * `loading.tsx` (bem-vindo e onboarding).
 *
 * **Sem animação de entrada, de propósito.** Se a tela real chega em 200ms,
 * animar a espera produz movimento duplo: o carregando entra, sai, e a página
 * entra atrás. Só o spinner se move, e ele comunica estado, não decora — é a
 * mesma razão pela qual `.animate-spin` é a única exceção do bloco
 * `prefers-reduced-motion` no `globals.css`.
 *
 * `min-h-40` para o card ocupar aproximadamente a altura do conteúdo que vem
 * depois, senão a troca empurra o layout.
 */
export function AuthCarregando({ rotulo = 'Preparando…' }: { rotulo?: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 py-10">
        <Loader2 aria-hidden className="text-primary size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">{rotulo}</p>
      </CardContent>
    </Card>
  )
}
