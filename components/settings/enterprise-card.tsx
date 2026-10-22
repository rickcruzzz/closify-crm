import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ENTERPRISE_COLABORADORES } from '@/lib/enterprise/plano'

export function EnterpriseCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Enterprise</CardTitle>
          <Badge>Plano atual</Badge>
        </div>
        <CardDescription>
          Acesso aos recursos do CRM para o proprietário e até {ENTERPRISE_COLABORADORES}{' '}
          colaboradores nesta empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground flex flex-col gap-3 text-sm">
        <p>
          Funil, contatos, tarefas, orçamentos, relatórios e Radar de eventos incluídos.
        </p>
        <p>
          Google Calendar, Gmail e WhatsApp incluídos. Conecte suas contas para começar a
          usar.
        </p>
        <p>
          Convites pendentes reservam vagas. Cada colaborador confirma o e-mail antes de
          entrar.
        </p>
      </CardContent>
    </Card>
  )
}
