'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlanComparisonTable } from '@/components/settings/plan-comparison-table'
import { PRO_PLAN_PRICE } from '@/lib/plans'

/**
 * O que uma conta Free vê ao tentar usar algo que é do Pro.
 *
 * Antes desta tela, quem estava no Free clicava em "Conectar Google Calendar",
 * SAÍA da página, ia até `/api/integrations/google/connect`, o servidor
 * recusava e a pessoa voltava com um toast cinza escrito "Conecte o plano Pro
 * para usar integrações". Uma viagem inteira ao servidor para dizer não, sem
 * dizer quanto custa, o que mais vem junto, nem para onde ir.
 *
 * Aqui a comparação inteira está na frente e as duas saídas são explícitas.
 * "Continuar no Free" existe de propósito: fechar sem escolher é uma resposta
 * legítima, e um diálogo que só oferece o caminho de pagar é armadilha.
 */
export function ProUpsellDialog({
  open,
  onOpenChange,
  recurso,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** O que a pessoa tentou fazer, para o título falar do caso dela. */
  recurso: string
}) {
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{recurso} está no plano Pro</DialogTitle>
          <DialogDescription>
            Veja o que muda antes de decidir. Você pode continuar no Free à vontade.
          </DialogDescription>
        </DialogHeader>

        {/* A mesma tabela da aba Plano, com os limites reais de `lib/plans.ts`.
            Duas listas que discordassem sobre o que o Pro entrega seria pior
            que não ter comparação nenhuma. */}
        <PlanComparisonTable plan="free" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continuar no Free
          </Button>
          {/* Navega em vez de abrir o formulário aqui: `SubscribeButton` já
              abre um diálogo próprio para pedir CPF/CNPJ, e colocá-lo dentro
              deste criaria diálogo dentro de diálogo. `?assinar=1` faz a aba
              Plano abrir o formulário sozinha, pelo mesmo caminho que já
              atende quem clica "Assinar Pro" na landing. */}
          <Button
            onClick={() => {
              onOpenChange(false)
              router.push('/settings?aba=plano&assinar=1')
            }}
          >
            <Zap className="size-4" />
            Assinar Pro por R$ {PRO_PLAN_PRICE}/mês
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
