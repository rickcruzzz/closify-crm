import { Loader2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

// `onboarding/page.tsx` é Server Component com 3 idas ao banco (usuário,
// estado do onboarding, workspaces) antes de renderizar qualquer coisa —
// sem este fallback, o clique em "Começar configuração" ficava sem
// nenhum sinal visual até essas consultas terminarem.
export default function OnboardingLoading() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="text-primary size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Preparando…</p>
      </CardContent>
    </Card>
  )
}
