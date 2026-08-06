import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT, FREE_PLAN_PRICE, PRO_PLAN_PRICE } from '@/lib/limits'

export function PlanComparisonTable({ plan }: { plan: 'free' | 'pro' }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recurso</TableHead>
          <TableHead>
            <span className="inline-flex items-center gap-2">
              Free
              {plan === 'free' && <Badge variant="secondary">Atual</Badge>}
            </span>
          </TableHead>
          <TableHead>
            <span className="inline-flex items-center gap-2">
              Pro
              {plan === 'pro' && <Badge>Atual</Badge>}
            </span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="text-muted-foreground">Preço</TableCell>
          <TableCell>R$ {FREE_PLAN_PRICE}/mês</TableCell>
          <TableCell>R$ {PRO_PLAN_PRICE}/mês</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Leads</TableCell>
          <TableCell>Até {FREE_LEAD_LIMIT}</TableCell>
          <TableCell>Ilimitados</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Colaboradores</TableCell>
          <TableCell>Até {FREE_MEMBER_LIMIT}</TableCell>
          <TableCell>Ilimitados</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
