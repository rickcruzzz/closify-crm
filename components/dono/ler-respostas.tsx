'use client'

import * as React from 'react'
import { Loader2, ScanText } from 'lucide-react'
import { toast } from 'sonner'

import { classificarAgora } from '@/lib/dono/inteligencia-actions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * O botão que manda ler as respostas que chegaram.
 *
 * ## Ancora crua com `buttonVariants`, e não `<Button>`
 *
 * Não por estilo: `central-de-suporte.tsx` já usa este caminho, e a prateleira
 * pagou a lição em 08/09 — `<Button render={<a/>}>` com `onClick` descarta o
 * handler no merge do Base UI, e o clique não dispara **sem erro nenhum**.
 * Aqui é `<button>` de verdade, que é o elemento certo para uma ação.
 *
 * ## O contador fica no rótulo
 *
 * "Ler 3 respostas" e "Ler respostas" dizem coisas diferentes: o primeiro
 * promete trabalho, o segundo pede fé. E quando não há nada pendente o botão
 * some — botão que não faz nada ensina a ignorar botões.
 */
export function LerRespostas({ pendentes }: { pendentes: number }) {
  const [rodando, setRodando] = React.useState(false)

  if (pendentes === 0) return null

  async function executar() {
    setRodando(true)
    try {
      const r = await classificarAgora()
      if (r.ok) toast.success(r.mensagem)
      else toast.error(r.erro, { duration: 10000 })
    } finally {
      setRodando(false)
    }
  }

  return (
    <button
      type="button"
      onClick={executar}
      disabled={rodando}
      className={cn(buttonVariants({ size: 'sm' }), 'min-h-11 gap-2 sm:min-h-9')}
    >
      {rodando ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <ScanText className="size-4" aria-hidden />
      )}
      {rodando ? 'Lendo…' : `Ler ${pendentes} resposta${pendentes === 1 ? '' : 's'}`}
    </button>
  )
}
