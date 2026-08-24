import { AlertTriangle, TrendingDown } from 'lucide-react'

import { maiorVazamento, type DegrauDoFunil } from '@/lib/dono/ativacao'
import { cn } from '@/lib/utils'

/**
 * O funil de ativação, desenhado como funil.
 *
 * ## Por que barra proporcional e não tabela
 *
 * Tabela de números obriga a comparar mentalmente 6 valores para achar onde a
 * queda foi maior. A barra faz o vazamento aparecer sem ninguém procurar: o
 * degrau que encolhe é o problema, e ele se vê de longe.
 *
 * ## Por que os dois percentuais
 *
 * Respondem perguntas diferentes e ambas importam. **Do topo** mede o resultado
 * ("de cada 100 que se cadastram, quantos pagam"). **Do anterior** aponta o
 * vazamento ("é aqui que some gente"). Mostrar só o do topo esconde qual etapa
 * consertar; só o do anterior esconde se o todo está bom.
 */
export function FunilDeAtivacao({
  funil,
  excluidas,
}: {
  funil: DegrauDoFunil[]
  excluidas: number
}) {
  const topo = funil[0]?.quantas ?? 0
  const vazamento = maiorVazamento(funil)

  if (topo === 0) {
    return (
      <div className="border-border bg-card rounded-lg border p-6">
        <p className="text-muted-foreground text-sm">
          Nenhuma conta de cliente externo ainda. O funil aparece quando a primeira pessoa de
          fora criar conta.
          {excluidas > 0 && (
            <>
              {' '}
              <span className="text-foreground">{excluidas}</span>{' '}
              {excluidas === 1 ? 'conta interna ou de teste foi excluída' : 'contas internas ou de teste foram excluídas'}{' '}
              da contagem.
            </>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
        {funil.map((degrau) => {
          const largura = topo === 0 ? 0 : (degrau.quantas / topo) * 100
          const ehVazamento = vazamento?.degrau.etapa === degrau.etapa

          return (
            <div key={degrau.etapa} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn('truncate', ehVazamento && 'text-foreground font-medium')}>
                  {degrau.rotulo}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  <span className="text-foreground font-medium">{degrau.quantas}</span>
                  {degrau.percentualDoAnterior !== null && (
                    <> · {degrau.percentualDoAnterior}% do anterior</>
                  )}
                </span>
              </div>

              {/* A barra é a informação; o número ao lado é a conferência. */}
              <div className="bg-muted h-7 w-full overflow-hidden rounded">
                <div
                  className={cn(
                    'flex h-full items-center rounded px-2 transition-all',
                    ehVazamento ? 'bg-amber-500/70' : 'bg-primary/70',
                  )}
                  style={{ width: `${Math.max(largura, degrau.quantas > 0 ? 6 : 0)}%` }}
                >
                  {degrau.quantas > 0 && (
                    <span className="text-foreground/90 text-xs font-medium tabular-nums">
                      {degrau.percentualDoTopo}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {vazamento && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <TrendingDown className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">
              É em &ldquo;{vazamento.degrau.rotulo}&rdquo; que some mais gente
            </p>
            <p className="text-muted-foreground">
              {vazamento.perdeu} {vazamento.perdeu === 1 ? 'pessoa parou' : 'pessoas pararam'} antes
              deste passo. É o degrau que rende mais consertar — não o de menor porcentagem, e sim
              o que perde mais gente.
            </p>
          </div>
        </div>
      )}

      {/* O filtro precisa ficar visível: ele muda o número que decide investimento. */}
      {excluidas > 0 && (
        <p className="text-muted-foreground flex items-start gap-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {excluidas} {excluidas === 1 ? 'conta interna ou de teste ficou' : 'contas internas ou de teste ficaram'}{' '}
            de fora. Elas sempre &ldquo;ativam&rdquo; (quem cria já sabe usar) e nunca pagam — contá-las
            inflaria a ativação e afundaria a conversão.
          </span>
        </p>
      )}
    </div>
  )
}
