import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SubscribeButton } from '@/components/settings/subscribe-button'
import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  FREE_WORKSPACE_LIMIT,
  PRO_PLAN_PRICE,
} from '@/lib/plans'

/**
 * Card de plano em Configurações.
 *
 * Antes trazia apenas o badge Free e um botão `outline` "Ver cobrança", que
 * levava a mais uma tela antes de qualquer possibilidade de assinar, quem
 * queria pagar precisava descobrir o caminho sozinho. Os limites também eram
 * texto fixo ("até 2 colaboradores e 50 leads"), já desatualizado em relação
 * ao limite de empresa.
 *
 * Agora o card é o ponto de conversão: mostra o que o Pro entrega e abre o
 * checkout ali mesmo, reusando o `SubscribeButton` (que já faz máscara e
 * validação de CPF/CNPJ antes de chamar o Asaas).
 */
const GANHOS_DO_PRO = [
  'Empresas ilimitadas no mesmo login',
  'Colaboradores ilimitados',
  'Leads ilimitados',
  'Suporte prioritário',
]

export function PlanCard({
  plan,
  isAdmin,
  assinarDeInicio = false,
}: {
  plan: 'free' | 'pro'
  isAdmin: boolean
  /**
   * Abre o formulário de CPF assim que a tela carrega.
   *
   * Serve a quem chegou aqui pelo diálogo de integrações: essa pessoa já
   * decidiu, já viu a comparação, e obrigá-la a procurar e clicar de novo é
   * onde a compra se perde. Mesmo motivo do `?plano=pro` que vem da landing.
   */
  assinarDeInicio?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <div>
          <CardTitle>Plano</CardTitle>
          <CardDescription>
            {plan === 'pro'
              ? 'Empresas, colaboradores e leads ilimitados.'
              : `Plano Free: ${FREE_WORKSPACE_LIMIT} empresa, até ${FREE_MEMBER_LIMIT} colaboradores e ${FREE_LEAD_LIMIT} leads.`}
          </CardDescription>
        </div>
        <Badge variant={plan === 'pro' ? 'default' : 'secondary'}>
          {plan === 'pro' ? 'Pro' : 'Free'}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {plan === 'free' && (
          <>
            {/* Diz o que muda ao pagar. Sem isso o card só informava o limite
                atual, e o upgrade virava um salto no escuro. */}
            <div className="border-border/60 bg-muted/30 flex flex-col gap-3 rounded-lg border p-4">
              <p className="text-sm font-medium">
                No Pro, por R$ {PRO_PLAN_PRICE}/mês:
              </p>
              <ul className="flex flex-col gap-1.5">
                {GANHOS_DO_PRO.map((ganho) => (
                  <li
                    key={ganho}
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                  >
                    <Check
                      aria-hidden
                      className="size-4 shrink-0 text-emerald-500 dark:text-emerald-400"
                    />
                    {ganho}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Só admin assina, `createCheckout` recusa os demais, e mostrar
                  o botão a quem não pode usar só produz um caminho morto. */}
              {isAdmin ? (
                <SubscribeButton className="w-full sm:w-fit" abrirDeInicio={assinarDeInicio} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Peça a um administrador da empresa para fazer o upgrade.
                </p>
              )}

              <Button
                variant="ghost"
                className="w-full sm:w-fit"
                render={<Link href="/settings/billing" />}
              >
                Comparar planos
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </>
        )}

        {plan === 'pro' && (
          <Button
            variant="outline"
            className="w-fit"
            render={<Link href="/settings/billing" />}
          >
            Gerenciar assinatura
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
