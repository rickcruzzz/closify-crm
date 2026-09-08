'use client'

import * as React from 'react'
import { AlertTriangle, Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { ModeloDeMensagem } from '@/lib/dono/mensagens'
import { cn } from '@/lib/utils'

/**
 * O que vai sair, agrupado pelo que repete.
 *
 * ## Por que agrupado, e não uma lista de 882 textos
 *
 * Uma lista longa esconde a repetição — e a repetição é o achado. Medido em
 * 08/09: 788 mensagens "distintas" que são, na prática, dez modelos
 * personalizados pelo nome.
 *
 * A tela existe para o dono ver isso ANTES de mandar, porque texto quase
 * idêntico para centenas de destinos é o padrão que o WhatsApp detecta melhor,
 * e o número em risco é o dele.
 */
export function MensagensQueVaoSair({
  modelos,
  suspeitas,
}: {
  modelos: ModeloDeMensagem[]
  suspeitas: { dominio: string; abertura: string }[]
}) {
  const [aberto, setAberto] = React.useState<string | null>(modelos[0]?.chave ?? null)
  const [copiado, setCopiado] = React.useState<string | null>(null)

  const total = modelos.reduce((soma, m) => soma + m.quantas, 0)

  async function copiar(texto: string, chave: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(chave)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      // Área de transferência bloqueada não pode derrubar a tela: o texto
      // continua visível e selecionável logo acima do botão.
      toast.error('Não consegui copiar. Selecione o texto acima.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {modelos.map((m) => {
          const expandido = aberto === m.chave
          const fatia = Math.round((m.quantas / total) * 100)

          return (
            <div key={m.chave} className="border-border/60 overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => setAberto(expandido ? null : m.chave)}
                className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
              >
                <span className="bg-muted w-14 shrink-0 rounded px-2 py-1 text-center text-sm font-semibold tabular-nums">
                  {m.quantas}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {m.amostra[0]?.abertura ?? '(sem abertura)'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {m.vertical} · {m.comWhatsapp} com WhatsApp · {fatia}% da fila
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {expandido ? 'fechar' : 'ver a mensagem'}
                </span>
              </button>

              {expandido ? (
                <div className="border-border/60 bg-muted/20 flex flex-col gap-3 border-t px-4 py-3">
                  {/* `whitespace-pre-wrap` porque a mensagem tem quebras de
                      linha que são parte dela: no WhatsApp, parágrafo separado
                      é o que a faz ser lida em vez de ignorada. */}
                  <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                    {m.exemplo}
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void copiar(m.exemplo, m.chave)}
                      className="min-h-11 sm:min-h-8"
                    >
                      {copiado === m.chave ? (
                        <Check className="size-4" aria-hidden />
                      ) : (
                        <Copy className="size-4" aria-hidden />
                      )}
                      {copiado === m.chave ? 'Copiado' : 'Copiar o texto'}
                    </Button>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {m.exemplo.length} caracteres
                    </span>
                  </div>

                  <div className="text-muted-foreground text-xs">
                    <span className="text-foreground font-medium">
                      Como a saudação sai em outras empresas deste modelo:
                    </span>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {m.amostra.map((a) => (
                        <li key={a.dominio} className="truncate">
                          {a.abertura}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {suspeitas.length > 0 ? (
        <section className="border-border/60 flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-amber-500" aria-hidden />
            {suspeitas.length}{' '}
            {suspeitas.length === 1 ? 'saudação pesada' : 'saudações pesadas'}
          </h2>
          <p className="text-muted-foreground text-xs">
            Nome legítimo, só comprido demais para uma primeira frase. Não é defeito — é
            decisão sua se vale abrir essas à mão.
          </p>
          <ul className="text-muted-foreground mt-1 flex flex-col gap-1 text-xs">
            {suspeitas.slice(0, 12).map((s) => (
              <li key={s.dominio} className={cn('truncate')}>
                {s.abertura}
              </li>
            ))}
          </ul>
          {suspeitas.length > 12 ? (
            <p className="text-muted-foreground text-xs">e mais {suspeitas.length - 12}.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
