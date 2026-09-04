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
  // Dizia "leads", que é uma das palavras que o `docs/prd-copy-sem-jargao.md`
  // bane por nome e que a renomeação de 19/08 tirou do produto inteiro. A
  // landing já dizia "contatos"; esta tela, que é o que quem PAGA lê, ficou
  // para trás — duas superfícies do mesmo limite, com dois nomes.
  `Até ${FREE_LEAD_LIMIT} contatos`,
  'Funil visual, arrasta e solta',
  'Painel de resultados',
  'Convites por e-mail',
  // Nenhum gate de plano no caminho, conferido em `api/leads/exportar` e no
  // diálogo de importação. A landing lista os dois; esta ficaria a menos.
  'Importe e exporte seus contatos',
]

/**
 * A MESMA lista da seção de planos da landing, na mesma ordem.
 *
 * Antes eram três descrições diferentes do mesmo plano — aqui, no
 * `plan-card.tsx` e na landing — e as três discordavam: só uma dizia "empresas
 * ilimitadas", nenhuma dizia "Tudo do Free", e esta repetia funil, painel e
 * convites nos dois planos, gastando três das nove linhas para dizer o que a
 * pessoa já tem.
 *
 * Divergência entre superfícies é a classe que este projeto já pagou com o CNPJ
 * em dois lugares e com a promessa de trial em três. Ao mexer numa, mexer nas
 * três.
 */
const PRO_FEATURES = [
  'Tudo do Free',
  // Google Calendar e Gmail são exclusivos do Pro desde 12/08 e estavam fora
  // desta lista, que é justamente a que existe para convencer alguém a pagar.
  // São o recurso mais concreto do plano: o resto é "mais do mesmo, sem
  // limite", estes dois são coisa que o Free não faz de jeito nenhum.
  'Agenda ligada ao Google Calendar',
  'E-mail pelo Gmail, registrado no cliente',
  // Os três limites do Free, respondidos um a um. "Várias empresas no mesmo
  // login" não dizia ilimitado, e é — conferido na 0057: o teto de 1 empresa
  // só existe `if not tem_plano_pro`.
  'Empresas ilimitadas',
  'Colaboradores ilimitados',
  'Contatos ilimitados',
  // Não há linha de suporte, e ela NÃO deve voltar como "prioritário": era
  // falso, não existe fila nem SLA. Se um dia voltar, só como PRAZO cumprível.
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
