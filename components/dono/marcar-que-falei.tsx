'use client'

import * as React from 'react'
import { Check, Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import { desmarcarQueFalei, marcarQueFalei } from '@/lib/dono/trial-actions'
import { cn } from '@/lib/utils'

/**
 * O botão que fecha o laço da fila.
 *
 * Marcar e desmarcar no mesmo lugar, e não um menu com "desfazer" escondido: a
 * marcação errada acontece no reflexo (clicou na linha de cima), e o conserto
 * precisa estar onde o erro foi cometido. É a mesma decisão dos Alertas, onde
 * "silenciar" sem volta seria o mesmo que perder.
 */
export function MarcarQueFalei({
  workspaceId,
  nome,
  faladoEm,
}: {
  workspaceId: string
  nome: string
  faladoEm: string | null
}) {
  const [pendente, setPendente] = React.useState(false)

  async function executar(acao: () => Promise<{ ok: boolean; mensagem?: string; erro?: string }>) {
    setPendente(true)
    try {
      const resultado = await acao()
      if (resultado.ok) toast.success(resultado.mensagem ?? 'Pronto.')
      else toast.error(resultado.erro ?? 'Não deu certo.', { duration: 8000 })
    } finally {
      setPendente(false)
    }
  }

  const jaFalei = Boolean(faladoEm)

  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        executar(() =>
          jaFalei ? desmarcarQueFalei(workspaceId, nome) : marcarQueFalei(workspaceId, nome),
        )
      }
      className={cn(
        'focus-visible:ring-ring/50 flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 disabled:opacity-60',
        jaFalei
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
          : 'border-border hover:bg-accent',
      )}
    >
      {pendente ? (
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
      ) : jaFalei ? (
        <Undo2 aria-hidden className="size-3.5" />
      ) : (
        <Check aria-hidden className="size-3.5" />
      )}
      {jaFalei ? 'Voltar para a fila' : 'Já falei'}
    </button>
  )
}
