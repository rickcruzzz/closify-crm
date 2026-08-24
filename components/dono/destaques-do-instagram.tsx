'use client'

import * as React from 'react'
import { Download, DownloadCloud } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { enderecoDaTela, type Destaque } from '@/lib/dono/destaques'
import { cn } from '@/lib/utils'

/**
 * As telas prontas, agrupadas pelo destaque em que entram e na ordem de subir.
 *
 * ## Por que a ordem aparece em número aqui e não na arte
 *
 * O Instagram exibe o destaque na sequência em que os Stories foram postados,
 * e não dá para reordenar depois sem apagar e repostar — então quem sobe
 * precisa da ordem à vista. Na ARTE o número foi removido de propósito: quem
 * abre o destaque pelo meio não viu o primeiro, e um "03" solto atrapalha
 * mais do que ordena. Ordem é informação de quem publica, não de quem assiste.
 */
export function DestaquesDoInstagram({ destaques }: { destaques: Destaque[] }) {
  if (destaques.length === 0) {
    return (
      <div className="border-border bg-card rounded-lg border p-6">
        <p className="text-sm font-medium">Nenhuma tela gerada ainda.</p>
        <p className="text-muted-foreground mt-1 text-sm text-pretty">
          Rode <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
            python scripts/marketing/gerar-stories.py
          </code>{' '}
          e recarregue. Ele desenha as telas e deixa tudo aqui na mesma passada.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {destaques.map((destaque) => (
        <BlocoDoDestaque key={destaque.id} destaque={destaque} />
      ))}
    </div>
  )
}

function BlocoDoDestaque({ destaque }: { destaque: Destaque }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-lg font-semibold tracking-tight">{destaque.nome}</h2>
          <Badge variant="secondary">{destaque.telas.length} telas</Badge>
          <BaixarTudo destaque={destaque} />
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">{destaque.resumo}</p>
      </header>

      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {destaque.telas.map((tela) => (
          // `h-full` + `mt-auto` nos botões: sem isso, um título de duas linhas
          // empurra o botão dele para baixo e a fileira inteira fica com os
          // botões em alturas diferentes — o olho lê como desalinho, não como
          // texto mais longo.
          <li key={tela.arquivo} className="flex h-full flex-col gap-2">
            {/*
              Imagem crua, não `next/image`: o arquivo vive fora de `public/` e
              é servido por rota dinâmica, então o otimizador não tem o que
              pré-processar — e esta tela só roda em localhost, onde peso de
              imagem não é problema de ninguém.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enderecoDaTela(tela.arquivo)}
              alt={tela.titulo}
              className="border-border bg-muted aspect-[9/16] w-full rounded-md border object-cover"
              loading="lazy"
            />

            <div className="flex flex-1 flex-col gap-1">
              <p className="text-xs font-medium tabular-nums">
                <span className="text-muted-foreground">{tela.ordem}.</span> {tela.titulo}
              </p>
              <div className="mt-auto flex items-center gap-2">
                <a
                  href={enderecoDaTela(tela.arquivo)}
                  download={tela.arquivo}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'h-8 flex-1 text-xs',
                  )}
                >
                  <Download className="size-3.5" />
                  Baixar
                </a>
                {/*
                  O 4K fica secundário de propósito: subir ele no Instagram dá
                  resultado PIOR — o app recomprime para 1080 de largura de
                  qualquer jeito, às vezes com mais artefato que a redução
                  controlada que o gerador já fez. Ele serve para feed e
                  anúncio, não para o Story.
                */}
                <a
                  href={enderecoDaTela(tela.arquivo4k)}
                  download={tela.arquivo4k}
                  title="Versão 4K — para feed ou anúncio, não para o Story"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 px-2 text-xs')}
                >
                  4K
                </a>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Baixa as telas do destaque em sequência, na ordem de publicação.
 *
 * ## Por que não um .zip
 *
 * Zipar no servidor exigiria dependência nova no `package.json` do produto
 * inteiro por causa de uma tela que só roda na máquina do dono — o mesmo
 * motivo pelo qual `lib/dono/criativos.ts` lê dimensão de PNG na mão em vez
 * de instalar um processador de imagem.
 *
 * O intervalo entre um clique e outro não é enfeite: disparados no mesmo
 * tique, o navegador trata a rajada como pop-up e engole todos menos o
 * primeiro. E o nome do arquivo já carrega a ordem (`demo-2-trazer`), então a
 * pasta de download fica ordenada sozinha, mesmo que os arquivos cheguem
 * fora de ordem.
 */
function BaixarTudo({ destaque }: { destaque: Destaque }) {
  const [baixando, setBaixando] = React.useState(false)

  async function baixar() {
    setBaixando(true)
    try {
      for (const tela of destaque.telas) {
        const link = document.createElement('a')
        link.href = enderecoDaTela(tela.arquivo)
        link.download = tela.arquivo
        document.body.appendChild(link)
        link.click()
        link.remove()
        await new Promise((resolve) => setTimeout(resolve, 350))
      }
      toast.success(`${destaque.telas.length} telas baixadas`, {
        description: 'Suba na ordem do nome do arquivo: 1, 2, 3…',
      })
    } finally {
      setBaixando(false)
    }
  }

  return (
    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={baixar} disabled={baixando}>
      <DownloadCloud className="size-3.5" />
      {baixando ? 'Baixando…' : 'Baixar todas'}
    </Button>
  )
}
