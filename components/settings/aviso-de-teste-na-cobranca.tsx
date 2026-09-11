'use client'

import * as React from 'react'
import { FREE_LEAD_LIMIT, FREE_ORCAMENTO_LIMIT } from '@/lib/plans'
import { Clock } from 'lucide-react'

import { estadoDoVencimento, textoDeQuantoFalta } from '@/lib/plans/vencimento'

/**
 * Quando o teste grátis termina, na tela de Cobrança.
 *
 * ## Por que existe, se já há a tarja no topo do produto
 *
 * A tarja (`components/layout/aviso-de-trial.tsx`) só aparece na reta final, a
 * partir de 4 dias, e de propósito: aviso permanente vira paisagem antes de
 * virar venda.
 *
 * Mas quem abre **Cobrança** está fazendo outra pergunta, e no dia 1 tanto
 * quanto no dia 6: *o que eu tenho e até quando*. Até 25/08 essa pergunta não
 * era respondida em lugar nenhum — `trial_ate` só chegava ao layout, e a tela
 * de Cobrança mostrava as barras de uso sem dizer que o teto ali era temporário.
 *
 * ## Por que é client component
 *
 * A conta é de dia de CALENDÁRIO em São Paulo, e o servidor da Vercel roda em
 * UTC. Calculada no servidor, um teste que termina hoje à noite apareceria
 * como terminado para quem abrisse a tela de madrugada.
 */
export function AvisoDeTesteNaCobranca({ trialAte }: { trialAte: string | null }) {
  const estado = React.useMemo(() => estadoDoVencimento(trialAte), [trialAte])

  if (!estado) return null

  // Teste que já acabou não vira aviso aqui: a pessoa está no Free, as barras
  // de uso logo abaixo já mostram os limites reais, e repetir "acabou" ao lado
  // delas seria dizer duas vezes a mesma coisa.
  if (estado.vencido) return null

  return (
    <div className="border-border/60 flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Clock aria-hidden className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Teste grátis do Pro</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm">
          Termina em{' '}
          <span className="text-foreground font-medium">{estado.dataPorExtenso}</span>
        </span>
        <span
          className={
            estado.destacar
              ? 'text-sm font-medium text-amber-600 dark:text-amber-500'
              : 'text-muted-foreground text-sm'
          }
        >
          · {textoDeQuantoFalta(estado)}
        </span>
      </div>

      {/* O que PARA de funcionar, não "o teste expira".
          Mesma régua de `textoDoAviso` e do e-mail de fim de trial: é a perda
          concreta que faz decidir, não a data. Os três textos precisam
          continuar dizendo a mesma coisa. */}
      <p className="text-muted-foreground text-sm">
        Depois disso o orçamento com lembrete trava em {FREE_ORCAMENTO_LIMIT} ao mesmo tempo e o
        cadastro de contatos trava em {FREE_LEAD_LIMIT}. Nada é apagado.
      </p>
    </div>
  )
}
