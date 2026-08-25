'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { camposDoPerfil, type CampoDoPerfil } from '@/lib/dono/perfil-instagram'
import { cn } from '@/lib/utils'

/**
 * O perfil escrito uma vez, copiado para toda conta.
 *
 * ## Por que botão de copiar, e não texto para selecionar
 *
 * A bio tem quebra de linha, e quebra de linha é exatamente o que se perde ao
 * arrastar o mouse sobre um bloco de texto — cola tudo numa linha só e a bio
 * fica ilegível. O botão copia o valor exato, com as quebras.
 *
 * ## Por que o contador de caracteres aparece
 *
 * O Instagram corta em silêncio: passou de 150, o fim some sem aviso. E o fim é
 * onde mora o "sem cartão 👇", que é a linha que tira a última objeção. Ver o
 * número na tela é o que impede alguém de editar a bio aqui e estourar o teto
 * sem perceber.
 */
function Campo({ campo }: { campo: CampoDoPerfil }) {
  const [copiado, setCopiado] = React.useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(campo.valor)
      setCopiado(true)
      toast.success(`${campo.rotulo} copiado.`)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('O navegador recusou o acesso à área de transferência.')
    }
  }

  const excedeu = campo.teto ? campo.valor.length > campo.teto : false

  return (
    <div className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{campo.rotulo}</span>
        {campo.teto ? (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs tabular-nums',
              excedeu ? 'bg-red-500/15 text-red-500' : 'bg-muted text-muted-foreground',
            )}
          >
            {campo.valor.length}/{campo.teto}
          </span>
        ) : null}
        <span className="grow" />
        <button
          type="button"
          onClick={copiar}
          className={cn(
            'focus-visible:ring-ring/50 flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3',
            copiado
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
              : 'border-border hover:bg-accent',
          )}
        >
          {copiado ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      {/* `whitespace-pre-wrap` porque a bio TEM quebra de linha e ela é
          significativa: as três linhas são problema, produto e oferta, nessa
          ordem. Colapsadas numa só, viram um parágrafo que ninguém lê. */}
      <pre className="bg-muted/50 overflow-x-auto rounded-md p-3 font-sans text-sm whitespace-pre-wrap">
        {campo.valor}
      </pre>

      <p className="text-muted-foreground text-xs text-pretty">{campo.porque}</p>
    </div>
  )
}

export function KitDoPerfil() {
  const campos = camposDoPerfil()

  async function copiarTudo() {
    const texto = campos.map((c) => `${c.rotulo}:\n${c.valor}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Perfil inteiro copiado.')
    } catch {
      toast.error('O navegador recusou o acesso à área de transferência.')
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">Kit do perfil</h2>
        <button
          type="button"
          onClick={copiarTudo}
          className="border-border hover:bg-accent focus-visible:ring-ring/50 flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3"
        >
          <Copy aria-hidden className="size-3.5" />
          Copiar tudo
        </button>
      </div>

      <p className="text-muted-foreground max-w-3xl text-sm text-pretty">
        Cole os mesmos valores em toda conta que representar a marca. Assim elas ficam idênticas
        por construção, e não por conferência manual — que falha na primeira alteração, quando um
        perfil é atualizado e o outro fica para trás sem ninguém notar.
      </p>

      <div className="flex flex-col gap-3">
        {campos.map((campo) => (
          <Campo key={campo.id} campo={campo} />
        ))}
      </div>
    </section>
  )
}
