'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Rocket, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ocultarChecklist } from '@/lib/onboarding/actions'
import { contarConcluidos, proximoPasso, type ItemDoChecklist } from '@/lib/onboarding/checklist'

/**
 * Traz o checklist de volta depois de fechado.
 *
 * ## O buraco que isto fecha
 *
 * `ocultarChecklist` aceita `true` e `false` desde que existe, e até 01/09
 * **nenhum lugar do produto a chamava com `false`**. Fechar o card era
 * definitivo: o único ponto do sistema que diz o que fazer em seguida sumia
 * com um clique, para sempre, e o estado ia para o banco, então nem trocar de
 * navegador trazia de volta.
 *
 * Medido no dia: **9 das 49 contas já haviam fechado.** Nenhuma delas tem
 * como reabrir.
 *
 * É a mesma classe do "silenciar" sem "reexibir" que a Central de alertas
 * pagou em 31/08, e da fila de relatos internos que existia sem porta. Ação
 * destrutiva de um clique precisa de volta, ainda mais quando o que ela
 * destrói é a orientação de quem acabou de chegar.
 *
 * O link é discreto de propósito: quem fechou pediu para não ser incomodado,
 * e devolver o card inteiro por cima seria ignorar o pedido. O que ele
 * garante é que a porta existe.
 */
export function RetomarChecklist({ pendentes }: { pendentes: number }) {
  const router = useRouter()
  const [abrindo, setAbrindo] = React.useState(false)

  async function retomar() {
    setAbrindo(true)
    const resultado = await ocultarChecklist(false)
    if ('error' in resultado) {
      setAbrindo(false)
      return
    }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={retomar}
      disabled={abrindo}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex w-fit items-center gap-1.5 rounded-md text-sm underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
    >
      <Rocket className="size-3.5" aria-hidden />
      {abrindo
        ? 'Abrindo…'
        : `Retomar a configuração (${pendentes} ${pendentes === 1 ? 'passo' : 'passos'})`}
    </button>
  )
}

/**
 * O checklist de ativação, no topo do Dashboard.
 *
 * Os itens chegam prontos do servidor, DERIVADOS do estado real do workspace,
 * ver `lib/onboarding/checklist.ts`. Aqui só há apresentação: nada é marcado
 * à mão, então nada pode discordar da tela.
 *
 * O card some sozinho quando os cinco estiverem feitos; a página nem o
 * renderiza. Fechar é preferência da pessoa e vai para o banco, porque
 * `localStorage` não sobrevive a trocar de navegador. E fechar tem volta, por
 * `RetomarChecklist` acima.
 */
export function ChecklistCard({ itens }: { itens: ItemDoChecklist[] }) {
  const router = useRouter()
  const [minimizado, setMinimizado] = React.useState(false)
  const [fechando, setFechando] = React.useState(false)

  const feitos = contarConcluidos(itens)
  const proximo = proximoPasso(itens)

  async function fechar() {
    setFechando(true)
    const resultado = await ocultarChecklist(true)

    if ('error' in resultado) {
      setFechando(false)
      return
    }

    router.refresh()
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg"
            >
              <Rocket className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">Configure seu Velo Funil</span>
              <span className="text-muted-foreground text-xs">
                {feitos} de {itens.length} concluídos
                {proximo && ` · próximo: ${proximo.titulo.toLowerCase()}`}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-expanded={!minimizado}
              aria-label={minimizado ? 'Expandir checklist' : 'Minimizar checklist'}
              onClick={() => setMinimizado((v) => !v)}
            >
              <ChevronDown
                className={cn('size-4 transition-transform', minimizado && '-rotate-90')}
              />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar checklist"
              disabled={fechando}
              onClick={fechar}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Barra de progresso segmentada, no mesmo formato do assistente. */}
        <div className="flex gap-1" aria-hidden>
          {itens.map((item) => (
            <span
              key={item.chave}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                item.concluido ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>

        {!minimizado && (
          <ul className="flex flex-col">
            {itens.map((item) => (
              <li key={item.chave}>
                <Link
                  href={item.href}
                  className={cn(
                    'hover:bg-accent/40 focus-visible:ring-ring/50 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors outline-none focus-visible:ring-3',
                    item.concluido && 'pointer-events-none',
                  )}
                  aria-disabled={item.concluido}
                  tabIndex={item.concluido ? -1 : undefined}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                      item.concluido
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input',
                    )}
                  >
                    {item.concluido && <Check className="size-3" />}
                  </span>

                  <span className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        'text-sm',
                        item.concluido && 'text-muted-foreground line-through',
                      )}
                    >
                      {item.titulo}
                    </span>
                    {!item.concluido && (
                      <span className="text-muted-foreground text-xs">{item.descricao}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
