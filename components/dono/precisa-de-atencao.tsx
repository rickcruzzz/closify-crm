import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

import type { Pendencia } from '@/lib/dono/tipos'
import { cn } from '@/lib/utils'

/**
 * O resumo dos alertas, no topo da Visão geral.
 *
 * ## Por que só as três mais graves
 *
 * A lista inteira mora em `/dono/alertas`. Aqui o trabalho é outro: fazer a
 * pessoa saber que existe algo, sem que a fila inteira empurre os números e a
 * lista de clientes para fora da tela. Três é o que cabe sem rolar e o
 * suficiente para dar o tamanho do problema.
 *
 * ## Por que some quando está vazio
 *
 * Um bloco "0 problemas" ocupando o topo todo dia treina o olho a pular aquela
 * região — e no dia em que aparecer algo, ele vai pular também. Mesma regra do
 * contador de tarefas da barra lateral do produto. No lugar, uma linha
 * discreta confirmando que a verificação rodou: "nada errado" e "não
 * verifiquei" parecem iguais numa tela em branco.
 *
 * Componente de servidor, sem estado: as ações todas vivem na página de
 * alertas, onde há espaço para explicar o que cada botão faz.
 */
export function PrecisaDeAtencao({ pendencias }: { pendencias: Pendencia[] }) {
  if (pendencias.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <CheckCircle2 aria-hidden className="size-4 text-emerald-500" />
        Conferi assinaturas, cobranças, e-mails e clientes: nada precisa de você agora.
      </div>
    )
  }

  const dinheiro = pendencias.filter((p) => p.gravidade === 'dinheiro').length
  const destaques = pendencias.slice(0, 3)
  const resto = pendencias.length - destaques.length

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
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

        <Link
          href="/dono/alertas"
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-sm transition-colors"
        >
          Ver e resolver
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {destaques.map((pendencia) => (
          <li
            key={pendencia.id}
            className={cn(
              'rounded-xl p-4 ring-1',
              pendencia.gravidade === 'dinheiro'
                ? 'bg-red-500/5 ring-red-500/20'
                : 'bg-amber-500/5 ring-amber-500/20',
            )}
          >
            <p className="text-sm font-medium">{pendencia.titulo}</p>
            <p className="text-muted-foreground line-clamp-2 text-sm text-pretty">
              {pendencia.detalhe}
            </p>
          </li>
        ))}
      </ul>

      {resto > 0 && (
        <Link
          href="/dono/alertas"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          e mais {resto} {resto === 1 ? 'alerta' : 'alertas'}
        </Link>
      )}
    </section>
  )
}
