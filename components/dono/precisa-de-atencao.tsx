'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { consertarAssinatura } from '@/lib/dono/actions'
import type { Pendencia } from '@/lib/dono/tipos'
import { cn } from '@/lib/utils'

/**
 * A fila de trabalho do dono.
 *
 * ## Por que ela some quando está vazia
 *
 * Um bloco "0 problemas" ocupando o topo todo dia treina o olho a pular aquela
 * região da tela — e no dia em que aparecer algo, ele vai pular também. Mesma
 * regra já aplicada ao contador de tarefas da barra lateral, que só aparece
 * quando há o que cobrar.
 *
 * No lugar dele, quando não há nada, entra uma linha discreta confirmando que
 * a verificação rodou. A diferença importa: "nada errado" e "não verifiquei"
 * parecem iguais numa tela em branco.
 *
 * ## Por que cada item tem botão
 *
 * Lista de problemas sem ação vira lista de culpa. O caso mais comum aqui
 * (assinatura ativa no Asaas que não virou Pro) tem conserto de um clique, e
 * deixar isso a dois passos de distância é o que faz o problema durar semanas.
 */
export function PrecisaDeAtencao({ pendencias }: { pendencias: Pendencia[] }) {
  if (pendencias.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <CheckCircle2 aria-hidden className="size-4 text-emerald-500" />
        Verifiquei assinaturas, cobranças e e-mails: nada precisa de você agora.
      </div>
    )
  }

  const dinheiro = pendencias.filter((p) => p.gravidade === 'dinheiro').length

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle aria-hidden className="size-5 text-amber-500" />
        <h2 className="text-lg font-semibold">
          {pendencias.length === 1
            ? '1 coisa precisa de você'
            : `${pendencias.length} coisas precisam de você`}
        </h2>
        {dinheiro > 0 && (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
            {dinheiro === 1 ? '1 envolve dinheiro' : `${dinheiro} envolvem dinheiro`}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {pendencias.map((pendencia) => (
          <ItemDePendencia key={pendencia.id} pendencia={pendencia} />
        ))}
      </ul>
    </section>
  )
}

function ItemDePendencia({ pendencia }: { pendencia: Pendencia }) {
  const [resolvendo, setResolvendo] = React.useState(false)
  const eDinheiro = pendencia.gravidade === 'dinheiro'

  async function resolver() {
    if (!pendencia.acao) return

    setResolvendo(true)
    try {
      const resultado = await consertarAssinatura(pendencia.acao.alvo)
      if (resultado.ok) {
        toast.success(resultado.mensagem)
      } else {
        // Duração longa de propósito: a mensagem de erro aqui explica um
        // estado do gateway de pagamento, não é algo que se entenda de relance.
        toast.error(resultado.erro, { duration: 10_000 })
      }
    } catch {
      toast.error('A correção falhou. O erro completo está no terminal.')
    } finally {
      setResolvendo(false)
    }
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl p-4 ring-1 sm:flex-row sm:items-start sm:justify-between',
        eDinheiro ? 'bg-red-500/5 ring-red-500/20' : 'bg-amber-500/5 ring-amber-500/20',
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium">{pendencia.titulo}</span>
        <p className="text-muted-foreground text-sm text-pretty">{pendencia.detalhe}</p>
        {pendencia.email && (
          <a
            href={`mailto:${pendencia.email}`}
            className="text-foreground w-fit text-sm underline underline-offset-4"
          >
            {pendencia.email}
          </a>
        )}
      </div>

      {pendencia.acao && (
        <Button
          variant={eDinheiro ? 'default' : 'outline'}
          size="sm"
          disabled={resolvendo}
          onClick={resolver}
          className="shrink-0"
        >
          {resolvendo && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {resolvendo ? 'Corrigindo…' : pendencia.acao.rotulo}
        </Button>
      )}
    </li>
  )
}
