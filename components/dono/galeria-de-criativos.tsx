'use client'

import * as React from 'react'
import Image from 'next/image'
import { Check, Download, Images, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { anotarCriativoAction } from '@/lib/dono/criativos-actions'
import { FORMATOS } from '@/lib/dono/formatos-do-meta'
import type { Criativo } from '@/lib/dono/criativos'
import { cn } from '@/lib/utils'

/**
 * As artes de anúncio disponíveis.
 *
 * ## Por que a tela vazia é a mais importante aqui
 *
 * Hoje a pasta está vazia — e vai continuar até o dono ativar o gerador de
 * imagem ou mandar uma arte pronta. Uma galeria vazia que só diz "nada aqui"
 * seria uma tela morta. Ela explica o que fazer e mostra as medidas que o Meta
 * espera, que é a informação que a pessoa precisa ANTES de ter a primeira arte,
 * não depois.
 */
export function GaleriaDeCriativos({ criativos }: { criativos: Criativo[] }) {
  if (criativos.length === 0) {
    return (
      <div className="ring-foreground/10 flex flex-col items-center gap-4 rounded-xl p-10 text-center ring-1">
        <Images aria-hidden className="text-muted-foreground size-8" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Nenhuma arte aqui ainda.</p>
          <p className="text-muted-foreground max-w-lg text-sm text-pretty">
            Peça no chat (&quot;faz 3 variações do anúncio sobre perder venda por esquecimento&quot;)
            ou coloque um arquivo na pasta <code>criativos/</code> do projeto. Toda imagem que
            estiver lá aparece aqui, medida e classificada.
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-2 text-left">
          <p className="text-muted-foreground text-xs font-medium uppercase">
            Medidas que o Meta espera
          </p>
          <ul className="flex flex-col gap-1">
            {FORMATOS.map((formato) => (
              <li key={formato.nome} className="text-sm">
                <span className="font-medium">{formato.nome}</span>{' '}
                <span className="text-muted-foreground tabular-nums">
                  {formato.largura}×{formato.altura}
                </span>{' '}
                <span className="text-muted-foreground">— {formato.onde}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {criativos.map((criativo) => (
        <CartaoDeCriativo key={criativo.arquivo} criativo={criativo} />
      ))}
    </ul>
  )
}

function CartaoDeCriativo({ criativo }: { criativo: Criativo }) {
  const [nota, setNota] = React.useState(criativo.nota)
  const [salvando, setSalvando] = React.useState(false)
  const [salvo, setSalvo] = React.useState(false)

  const url = `/api/dono/criativo/${encodeURIComponent(criativo.arquivo)}`
  const serve = criativo.classificacao.serve

  async function salvarNota() {
    setSalvando(true)
    try {
      await anotarCriativoAction(criativo.arquivo, nota)
      setSalvo(true)
      // O aviso de salvo some sozinho: um "salvo" permanente vira parte da
      // decoração e para de significar que algo aconteceu agora.
      setTimeout(() => setSalvo(false), 2000)
    } catch {
      toast.error('Não consegui salvar a anotação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <li className="ring-foreground/10 flex flex-col overflow-hidden rounded-xl ring-1">
      {/* `bg-muted` atrás da imagem: arte com fundo transparente ou muito clara
          some contra o fundo escuro do painel, e some justamente a parte que a
          pessoa precisa julgar. */}
      <div className="bg-muted relative aspect-square">
        <Image
          src={url}
          alt={criativo.arquivo}
          fill
          // `unoptimized`: a imagem vem de uma rota dinâmica local, e o
          // otimizador do Next tentaria buscá-la por HTTP para reprocessar —
          // trabalho inútil numa tela que roda na mesma máquina do arquivo.
          unoptimized
          className="object-contain"
          sizes="(max-width: 640px) 100vw, 33vw"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="truncate text-sm font-medium" title={criativo.arquivo}>
            {criativo.arquivo}
          </p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {criativo.largura}×{criativo.altura} · {(criativo.peso / 1024).toFixed(0)} KB
          </p>
        </div>

        <div
          className={cn(
            'rounded-lg px-2 py-1.5 text-xs',
            serve ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500',
          )}
        >
          {serve ? (
            <>
              <span className="font-medium">{criativo.classificacao.formato.nome}</span>
              {criativo.classificacao.observacao && (
                <span className="text-muted-foreground block">
                  {criativo.classificacao.observacao}
                </span>
              )}
            </>
          ) : (
            criativo.classificacao.motivo
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={nota}
              onChange={(e) => {
                setNota(e.target.value)
                setSalvo(false)
              }}
              onBlur={() => nota !== criativo.nota && salvarNota()}
              placeholder="Anotar (campanha, resultado…)"
              className="h-9 text-sm"
              aria-label={`Anotação sobre ${criativo.arquivo}`}
            />
            {salvando ? (
              <Loader2 aria-hidden className="text-muted-foreground mt-2 size-4 shrink-0 animate-spin" />
            ) : salvo ? (
              <Check aria-hidden className="mt-2 size-4 shrink-0 text-emerald-500" />
            ) : null}
          </div>

          <Button
            variant="outline"
            size="sm"
            render={<a href={url} download={criativo.arquivo} />}
          >
            <Download aria-hidden className="size-4" />
            Baixar
          </Button>
        </div>
      </div>
    </li>
  )
}
