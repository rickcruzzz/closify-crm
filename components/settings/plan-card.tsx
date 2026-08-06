import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function PlanCard({ plan }: { plan: 'free' | 'pro' }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Plano</CardTitle>
          <CardDescription>
            {plan === 'pro'
              ? 'Plano Pro: colaboradores e leads ilimitados.'
              : 'Plano Free: até 2 colaboradores e 50 leads.'}
          </CardDescription>
        </div>
        <Badge variant={plan === 'pro' ? 'default' : 'secondary'}>
          {plan === 'pro' ? 'Pro' : 'Free'}
        </Badge>
      </CardHeader>
      <CardContent>
        <Button variant="outline" render={<Link href="/settings/billing">Ver cobrança</Link>} />
      </CardContent>
    </Card>
  )
}
