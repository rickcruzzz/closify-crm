'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cancelSubscription } from '@/lib/asaas/actions'
import type { EstadoAssinatura } from '@/lib/asaas/queries'

const formatadorBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * Estado da assinatura na tela de Cobrança.
 *
 * Antes a tela mostrava apenas o plano (Free/Pro). Quem criava a assinatura e
 * não pagava via "Free" com um botão de assinar de novo, sem aviso de fatura
 * em aberto, sem link para pagá-la e sem forma de cancelar. Era o caso das
 * assinaturas que a auditoria encontrou: `ACTIVE` no Asaas, pagamento
 * `PENDING`, nada disso visível aqui.
 */
export function SubscriptionCard({
  estado,
  isAdmin,
}: {
  estado: EstadoAssinatura
  isAdmin: boolean
}) {
  const router = useRouter()
  const [cancelarAberto, setCancelarAberto] = React.useState(false)
  const [confirmacao, setConfirmacao] = React.useState('')
  const [cancelando, setCancelando] = React.useState(false)

  const podeCancelar = confirmacao.trim().toUpperCase() === 'CANCELAR'

  async function handleCancelar() {
    if (!podeCancelar) return
    setCancelando(true)
    const resultado = await cancelSubscription({ confirmacao: 'CANCELAR' })
    if (resultado?.error) {
      toast.error(resultado.error)
      setCancelando(false)
      return
    }
    toast.success('Assinatura cancelada. A cobrança não se repete.')
    setCancelarAberto(false)
    setCancelando(false)
    router.refresh()
  }

  const visual = {
    active: {
      rotulo: 'Ativa',
      variante: 'default' as const,
      Icone: CheckCircle2,
      cor: 'text-emerald-500 dark:text-emerald-400',
    },
    trialing: {
      rotulo: 'Aguardando pagamento',
      variante: 'secondary' as const,
      Icone: Clock,
      cor: 'text-amber-500 dark:text-amber-400',
    },
    past_due: {
      rotulo: 'Pagamento atrasado',
      variante: 'destructive' as const,
      Icone: AlertTriangle,
      cor: 'text-destructive',
    },
    canceled: {
      rotulo: 'Cancelada',
      variante: 'secondary' as const,
      Icone: AlertTriangle,
      cor: 'text-muted-foreground',
    },
  }[estado.status]

  return (
    <>
      <div className="border-border/60 flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <visual.Icone aria-hidden className={`size-4 ${visual.cor}`} />
            <span className="text-sm font-medium">Assinatura Pro</span>
          </div>
          <Badge variant={visual.variante}>{visual.rotulo}</Badge>
        </div>

        {estado.fatura && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              {estado.fatura.vencida ? (
                <>
                  Fatura de{' '}
                  <span className="text-foreground font-medium">
                    {formatadorBRL.format(estado.fatura.valor)}
                  </span>{' '}
                  venceu em {formatarData(estado.fatura.vencimento)}. O acesso Pro só é
                  liberado após a confirmação do pagamento.
                </>
              ) : (
                <>
                  Fatura de{' '}
                  <span className="text-foreground font-medium">
                    {formatadorBRL.format(estado.fatura.valor)}
                  </span>{' '}
                  em aberto, com vencimento em {formatarData(estado.fatura.vencimento)}.
                  Pague por Pix, boleto ou cartão.
                </>
              )}
            </p>

            <Button
              className="w-fit"
              render={
                <a href={estado.fatura.url} target="_blank" rel="noopener noreferrer" />
              }
            >
              Pagar fatura
              <ExternalLink className="size-4" />
            </Button>
          </div>
        )}

        {estado.status === 'active' && !estado.fatura && (
          <p className="text-muted-foreground text-sm">
            Pagamento em dia. A próxima cobrança é gerada automaticamente no fim do
            ciclo.
          </p>
        )}

        {estado.status === 'canceled' && (
          <p className="text-muted-foreground text-sm">
            A cobrança recorrente foi encerrada. Você pode assinar de novo quando quiser.
          </p>
        )}

        {isAdmin && estado.status !== 'canceled' && estado.temAssinaturaNoAsaas && (
          <button
            type="button"
            onClick={() => setCancelarAberto(true)}
            className="text-muted-foreground hover:text-destructive w-fit text-xs underline underline-offset-4 transition-colors"
          >
            Cancelar assinatura
          </button>
        )}
      </div>

      <Dialog open={cancelarAberto} onOpenChange={setCancelarAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar assinatura?</DialogTitle>
            <DialogDescription>
              A cobrança recorrente para imediatamente e o workspace volta para o plano
              Free. Seus dados continuam salvos, mas os limites do Free voltam a valer.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmar-cancelamento">
              Para confirmar, digite <span className="text-foreground">CANCELAR</span>
            </Label>
            <Input
              id="confirmar-cancelamento"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="CANCELAR"
              autoComplete="off"
              disabled={cancelando}
            />
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setCancelarAberto(false)}
              disabled={cancelando}
            >
              Manter assinatura
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelar}
              disabled={!podeCancelar || cancelando}
            >
              {cancelando && <Loader2 className="size-4 animate-spin" />}
              Cancelar assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
