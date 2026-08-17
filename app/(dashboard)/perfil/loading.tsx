import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * O esqueleto de `/perfil`.
 *
 * A tela espera duas idas ao Supabase, a sessão e as identidades, que dizem
 * se a pessoa entrou por e-mail ou pelo Google. Sem isto, o clique em "Meu
 * perfil" fica sem resposta visível até as duas voltarem.
 *
 * Dois cartões porque é o que a tela real tem: dados de exibição e acesso.
 */
export default function PerfilLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Meu perfil" description="Seus dados de acesso e exibição." />

      {[2, 1].map((campos, cartao) => (
        <Card key={cartao}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: campos }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-11 w-full max-w-sm md:h-9" />
              </div>
            ))}
            <Skeleton className="h-11 w-32 md:h-9" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
