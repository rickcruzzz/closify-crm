import { Loader2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

// `bem-vindo/page.tsx` é Server Component com até 3 idas ao banco (usuário,
// convite pendente, estado do onboarding) antes de renderizar qualquer coisa,
// mesmo padrão de `onboarding/loading.tsx`. Sem este fallback, chegar aqui
// (clique em "Acessar o Velo Funil" ou link direto) ficava sem nenhum sinal
// visual até essas consultas terminarem.
export default function BemVindoLoading() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="text-primary size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Preparando…</p>
      </CardContent>
    </Card>
  )
}
