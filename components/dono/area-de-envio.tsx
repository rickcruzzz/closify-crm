'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { medirArquivo } from '@/lib/dono/medir-no-navegador'
import { analisar, type Analise, type Candidato } from '@/lib/dono/posicionamentos'
import { cn } from '@/lib/utils'

type Destino = 'anuncio' | 'organico'

type NaFila = {
  id: string
  arquivo: File
  analise: Analise
  /** Guardada da conferência: medir de novo no envio seria decodificar o vídeo duas vezes. */
  medida: Candidato | null
  estado: 'analisando' | 'pronta' | 'enviando' | 'enviada' | 'recusada' | 'falhou'
  erro?: string
}

/**
 * Onde as peças entram.
 *
 * ## O princípio: recusar cedo, e explicar
 *
 * O pedido foi que só entre conteúdo bom. A tentação seria validar no envio —
 * mas aí a pessoa espera o upload de um vídeo de 200 MB para descobrir que a
 * proporção está errada. Aqui o arquivo é medido no navegador **antes de
 * subir**: em um segundo ela sabe se serve, e o que fazer se não servir.
 *
 * Nenhuma peça reprovada é enviada. As aprovadas mostram em quais dos dez
 * posicionamentos do Meta elas entram — que é a pergunta seguinte natural, e
 * hoje só se responde abrindo a documentação.
 */
export function AreaDeEnvio({ destino }: { destino: Destino }) {
  const router = useRouter()
  const [arrastando, setArrastando] = React.useState(false)
  const [fila, setFila] = React.useState<NaFila[]>([])
  const entrada = React.useRef<HTMLInputElement>(null)

  const aprovadas = fila.filter((f) => f.estado === 'pronta')
  const enviando = fila.some((f) => f.estado === 'enviando')

  async function receber(arquivos: FileList | File[]) {
    const lista = Array.from(arquivos)
    if (lista.length === 0) return

    const novos: NaFila[] = lista.map((arquivo) => ({
      id: `${arquivo.name}-${arquivo.size}-${Math.random().toString(36).slice(2, 8)}`,
      arquivo,
      analise: { aprovado: false, proporcao: null, posicionamentos: [], reprovacoes: [], ressalvas: [] },
      medida: null,
      estado: 'analisando',
    }))

    setFila((antes) => [...antes, ...novos])

    // Um por vez, em série: medir vídeo carrega metadados, e disparar dez de
    // uma vez faz o navegador engasgar sem ganho nenhum de tempo real.
    for (const item of novos) {
      const candidato = await medirArquivo(item.arquivo)
      const analise = analisar(candidato)

      setFila((antes) =>
        antes.map((f) =>
          f.id === item.id
            ? { ...f, analise, medida: candidato, estado: analise.aprovado ? 'pronta' : 'recusada' }
            : f,
        ),
      )
    }
  }

  async function enviarTudo() {
    for (const item of aprovadas) {
      setFila((antes) => antes.map((f) => (f.id === item.id ? { ...f, estado: 'enviando' } : f)))

      const corpo = new FormData()
      corpo.set('arquivo', item.arquivo)
      corpo.set('destino', destino)
      // A medida vem da conferência que já aconteceu. O servidor a reconfere
      // contra as mesmas regras antes de gravar — ver o comentário da rota
      // sobre por que medir no cliente é informação, não autorização.
      if (item.medida) {
        corpo.set('largura', String(item.medida.largura))
        corpo.set('altura', String(item.medida.altura))
        if (item.medida.duracao) corpo.set('duracao', String(item.medida.duracao))
      }

      try {
        const resposta = await fetch('/api/dono/upload', { method: 'POST', body: corpo })
        const dados = (await resposta.json()) as { erro?: string }

        if (!resposta.ok) {
          setFila((antes) =>
            antes.map((f) =>
              f.id === item.id ? { ...f, estado: 'falhou', erro: dados.erro } : f,
            ),
          )
          continue
        }

        setFila((antes) => antes.map((f) => (f.id === item.id ? { ...f, estado: 'enviada' } : f)))
      } catch {
        setFila((antes) =>
          antes.map((f) =>
            f.id === item.id ? { ...f, estado: 'falhou', erro: 'A conexão caiu no meio do envio.' } : f,
          ),
        )
      }
    }

    toast.success('Peças enviadas.')
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          void receber(e.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors duration-micro',
          arrastando ? 'border-primary bg-primary/5' : 'border-border/60',
        )}
      >
        <Upload aria-hidden className={cn('size-8', arrastando ? 'text-primary' : 'text-muted-foreground')} />

        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {destino === 'anuncio'
              ? 'Arraste as peças do anúncio aqui'
              : 'Arraste o conteúdo do orgânico aqui'}
          </p>
          <p className="text-muted-foreground max-w-md text-sm text-pretty">
            Fotos e vídeos. Cada arquivo é conferido antes de subir. O que não serve é recusado
            na hora, com o motivo.
          </p>
        </div>

        <input
          ref={entrada}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void receber(e.target.files)
            e.target.value = ''
          }}
        />

        <Button variant="outline" size="sm" onClick={() => entrada.current?.click()}>
          Escolher arquivos
        </Button>
      </div>

      {fila.length > 0 && (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {fila.map((item) => (
              <ItemDaFila
                key={item.id}
                item={item}
                aoRemover={() => setFila((antes) => antes.filter((f) => f.id !== item.id))}
              />
            ))}
          </ul>

          {aprovadas.length > 0 && (
            <div className="flex items-center gap-3">
              <Button onClick={enviarTudo} disabled={enviando}>
                {enviando && <Loader2 aria-hidden className="size-4 animate-spin" />}
                {enviando
                  ? 'Enviando…'
                  : `Enviar ${aprovadas.length} ${aprovadas.length === 1 ? 'peça' : 'peças'}`}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setFila([])}
                disabled={enviando}
              >
                Limpar lista
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ItemDaFila({ item, aoRemover }: { item: NaFila; aoRemover: () => void }) {
  const { analise, estado } = item
  const recusada = estado === 'recusada'
  const enviada = estado === 'enviada'
  const falhou = estado === 'falhou'

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-xl p-4 ring-1',
        recusada || falhou ? 'bg-red-500/5 ring-red-500/20' : 'ring-foreground/10',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {estado === 'analisando' || estado === 'enviando' ? (
            <Loader2 aria-hidden className="text-muted-foreground size-4 shrink-0 animate-spin" />
          ) : enviada ? (
            <CheckCircle2 aria-hidden className="size-4 shrink-0 text-emerald-500" />
          ) : recusada || falhou ? (
            <AlertTriangle aria-hidden className="size-4 shrink-0 text-red-500" />
          ) : (
            <CheckCircle2 aria-hidden className="size-4 shrink-0 text-emerald-500" />
          )}

          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{item.arquivo.name}</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {(item.arquivo.size / 1024 / 1024).toFixed(1)} MB
              {estado === 'analisando' && ' · conferindo…'}
              {estado === 'enviando' && ' · enviando…'}
              {enviada && ' · na galeria'}
            </span>
          </div>
        </div>

        {!enviada && estado !== 'enviando' && (
          <Button variant="ghost" size="icon-sm" onClick={aoRemover} aria-label="Tirar da lista">
            <X aria-hidden className="size-4" />
          </Button>
        )}
      </div>

      {/* Cada recusa diz o que está errado E o que fazer. Sem a segunda parte,
          a pessoa fica com um "não" e nenhum caminho. */}
      {recusada &&
        analise.reprovacoes.map((r) => (
          <div key={r.campo} className="flex flex-col gap-0.5 pl-6">
            <span className="text-sm text-red-500">{r.motivo}</span>
            <span className="text-muted-foreground text-sm text-pretty">{r.comoResolver}</span>
          </div>
        ))}

      {falhou && <p className="pl-6 text-sm text-red-500">{item.erro}</p>}

      {(estado === 'pronta' || enviada) && analise.posicionamentos.length > 0 && (
        <div className="flex flex-col gap-1.5 pl-6">
          <span className="text-muted-foreground text-xs">
            Serve em {analise.posicionamentos.length} posicionamento(s) ({analise.proporcao}):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {analise.posicionamentos.map((p) => (
              <span
                key={p.nome}
                className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500"
              >
                {p.nome}
              </span>
            ))}
          </div>
        </div>
      )}

      {(estado === 'pronta' || enviada) &&
        analise.ressalvas.map((r) => (
          <p key={r} className="text-muted-foreground pl-6 text-xs text-pretty">
            {r}
          </p>
        ))}
    </li>
  )
}
