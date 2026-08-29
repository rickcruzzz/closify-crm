import { Check, Zap } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  FREE_PLAN_PRICE,
  FREE_WORKSPACE_LIMIT,
  PRO_PLAN_PRICE,
} from '@/lib/plans'

const FREE_FEATURES = [
  `${FREE_WORKSPACE_LIMIT} empresa`,
  `Até ${FREE_MEMBER_LIMIT} colaboradores`,
  `Até ${FREE_LEAD_LIMIT} leads`,
  'Funil visual, arrasta e solta',
  'Painel de resultados',
  'Convites por e-mail',
]

const PRO_FEATURES = [
  'Várias empresas no mesmo login',
  'Colaboradores ilimitados',
  'Contatos ilimitados',
  // Google Calendar e Gmail são exclusivos do Pro desde 12/08 e estavam fora
  // desta lista, que é justamente a que existe para convencer alguém a pagar.
  // São o recurso mais concreto do plano: o resto é "mais do mesmo, sem
  // limite", estes dois são coisa que o Free não faz de jeito nenhum.
  'Agenda ligada ao Google Calendar',
  'E-mail pelo Gmail, registrado no cliente',
  'Funil visual, arrasta e solta',
  'Painel de resultados',
  'Convites por e-mail',
  /**
   * Era "Suporte prioritário", e era FALSO.
   *
   * Não existe fila, SLA nem sistema de chamado no produto: suporte é
   * `suporte@velofunil.com.br` encaminhando para uma caixa pessoal. Free e Pro
   * escrevem para o mesmo endereço e chegam na mesma pessoa — não há o que
   * priorizar.
   *
   * Mesma classe do "contatos ilimitados" removido da landing em 23/08 e do
   * CNPJ exibido como prova de confiança estando baixado.
   *
   * Corrigido nos TRÊS lugares onde aparecia, não só na landing: deixar a
   * promessa viva aqui dentro seria pior — é o que quem JÁ PAGOU lê.
   */
  'Suporte direto com quem faz o produto',
]

export function PlanComparisonTable({ plan }: { plan: 'free' | 'pro' }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <PlanCard
        name="Free"
        price={FREE_PLAN_PRICE}
        description="Para começar a organizar o funil de vendas."
        features={FREE_FEATURES}
        isCurrent={plan === 'free'}
      />
      <PlanCard
        name="Pro"
        price={PRO_PLAN_PRICE}
        description="Para equipes que estão crescendo."
        features={PRO_FEATURES}
        isCurrent={plan === 'pro'}
        recommended
      />
    </div>
  )
}

function PlanCard({
  name,
  price,
  description,
  features,
  isCurrent,
  recommended,
}: {
  name: string
  price: number
  description: string
  features: string[]
  isCurrent: boolean
  recommended?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border p-5',
        recommended ? 'border-primary/40 bg-primary/[0.03]' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{name}</span>
        {isCurrent && <Badge variant="secondary">Plano atual</Badge>}
        {!isCurrent && recommended && (
          <Badge className="gap-1">
            <Zap className="size-3" />
            Recomendado
          </Badge>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight">R$ {price}</span>
        <span className="text-muted-foreground text-sm">/mês</span>
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>

      <ul className="flex flex-col gap-2 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <Check className="text-primary size-4 shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
