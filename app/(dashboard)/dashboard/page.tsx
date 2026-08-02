import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const cards = [
  'Total de Leads',
  'Negócios Abertos',
  'Valor do Pipeline',
  'Taxa de Conversão',
]

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Métricas do seu funil de vendas." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card}>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {card}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
