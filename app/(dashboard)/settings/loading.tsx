import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* A descrição desta tela muda conforme a ABA ("Dados da sua empresa…",
          "Quem tem acesso…", "Seu plano atual…", "Conecte Google Calendar…"),
          e a aba vem de `searchParams`, que `loading.tsx` não recebe no App
          Router. O esqueleto não tem como saber qual frase virá.

          Ele afirmava "Dados da sua empresa, colaboradores e plano." — uma
          quinta frase, que não é a de nenhuma aba. Quem abrisse Equipe ou
          Plano lia uma descrição e depois outra, sem nunca ter pedido a
          primeira.

          Um espaço reservado resolve as duas coisas de uma vez: não afirma o
          que não sabe, e mantém a altura do bloco, então o conteúdo abaixo
          não salta quando o texto real chega. Reservar espaço para conteúdo
          assíncrono é a regra; adivinhar o conteúdo não é. */}
      <PageHeader
        title="Configurações"
        description={<Skeleton className="h-4 w-72 max-w-full" />}
      />

      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
