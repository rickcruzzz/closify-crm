'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, Download, Loader2, Megaphone, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { anotarCriativoAction } from '@/lib/dono/criativos-actions'
import type { Criativo, Destino } from '@/lib/dono/criativos'
import { POSICIONAMENTOS, proporcaoDe, posicionamentosPara } from '@/lib/dono/posicionamentos'
import { cn } from '@/lib/utils'

import { AreaDeEnvio } from './area-de-envio'

/**
 * A biblioteca de peças, separada por onde elas vão.
 *
 * ## Por que anúncio e orgânico não se misturam
 *
 * São materiais com régua diferente. Peça de anúncio precisa caber num dos
 * posicionamentos pagos e passa pela conferência de qualidade antes de entrar;
 * conteúdo orgânico tem outro ciclo e outro critério. Numa lista só, a hora de
 * montar campanha viraria garimpo — e garimpo é o tipo de atrito que faz
 * parar de testar criativo, que é a alavanca mais barata do tráfego pago.
 */
export function GaleriaDeCriativos({
  destino,
  pecas,
  totalAnuncio,
  totalOrganico,
}: {
  destino: Destino
  pecas: Criativo[]
  totalAnuncio: number
  totalOrganico: number
}) {
  return (
    <div className="flex flex-col gap-6">
      <Abas destino={destino} totalAnuncio={totalAnuncio} totalOrganico={totalOrganico} />

      <AreaDeEnvio destino={destino} />

      {pecas.length === 0 ? <Vazio destino={destino} /> : <Lista pecas={pecas} />}
    </div>
  )
}

function Abas({
  destino,
  totalAnuncio,
  totalOrganico,
}: {
  destino: Destino
  totalAnuncio: number
  totalOrganico: number
}) {
  const abas = [
    {
      valor: 'anuncio' as const,
      rotulo: 'Anúncio',
      icone: Megaphone,
      total: totalAnuncio,
      href: '/dono/criativos',
    },
    {
      valor: 'organico' as const,
      rotulo: 'Orgânico',
      icone: Sparkles,
      total: totalOrganico,
      href: '/dono/criativos?tipo=organico',
    },
  ]

  return (
    <div role="tablist" className="border-border/60 -mb-px flex gap-1 border-b">
      {abas.map((aba) => {
        const ativa = aba.valor === destino
        const Icone = aba.icone

        return (
          <Link
            key={aba.valor}
            href={aba.href}
            role="tab"
            aria-selected={ativa}
            className={cn(
              'focus-visible:ring-ring/50 flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
              ativa
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            <Icone aria-hidden className="size-4" />
            {aba.rotulo}
            {aba.total > 0 && (
              <span className="text-muted-foreground text-xs tabular-nums">{aba.total}</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

/**
 * A tela vazia, que é a mais importante enquanto não há nada.
 *
 * Ela não diz apenas "nada aqui": mostra as medidas que o Meta espera e onde
 * cada uma aparece. É a informação que a pessoa precisa **antes** de ter a
 * primeira peça, não depois.
 */
function Vazio({ destino }: { destino: Destino }) {
  if (destino === 'organico') {
    return (
      <div className="ring-foreground/10 flex flex-col gap-2 rounded-xl p-8 text-center ring-1">
        <p className="font-medium">Nenhum conteúdo orgânico ainda.</p>
        <p className="text-muted-foreground mx-auto max-w-lg text-sm text-pretty">
          Aqui entra o que vai para o perfil sem impulsionar. A conferência é a mesma do anúncio:
          vertical em 1080×1920 rende mais em Reels, e o que não bater medida é recusado com o
          motivo.
        </p>
      </div>
    )
  }

  const porProporcao = [
    { proporcao: '1:1' as const, medida: '1080×1080' },
    { proporcao: '4:5' as const, medida: '1080×1350' },
    { proporcao: '9:16' as const, medida: '1080×1920' },
  ]

  return (
    <div className="ring-foreground/10 flex flex-col gap-4 rounded-xl p-8 ring-1">
      <div className="flex flex-col gap-1 text-center">
        <p className="font-medium">Nenhuma peça de anúncio ainda.</p>
        <p className="text-muted-foreground mx-auto max-w-lg text-sm text-pretty">
          Arraste fotos ou vídeos acima. Estas são as três medidas que cobrem os dez
          posicionamentos do Meta:
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {porProporcao.map((item) => (
          <div key={item.proporcao} className="ring-foreground/10 flex flex-col gap-1 rounded-lg p-3 ring-1">
            <span className="text-sm font-medium">
              {item.medida}{' '}
              <span className="text-muted-foreground font-normal">({item.proporcao})</span>
            </span>
            <span className="text-muted-foreground text-xs text-pretty">
              {posicionamentosPara(item.proporcao)
                .map((p) => p.nome)
                .join(' · ')}
            </span>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Vídeo: MP4 ou MOV, até 90s no vertical, 15 a 60s rende melhor.
      </p>
    </div>
  )
}

function Lista({ pecas }: { pecas: Criativo[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pecas.map((peca) => (
        <Cartao key={`${peca.destino}/${peca.arquivo}`} peca={peca} />
      ))}
    </ul>
  )
}

function Cartao({ peca }: { peca: Criativo }) {
  const [nota, setNota] = React.useState(peca.nota)
  const [salvando, setSalvando] = React.useState(false)
  const [salvo, setSalvo] = React.useState(false)

  const url = `/api/dono/criativo/${peca.destino}/${encodeURIComponent(peca.arquivo)}`
  const proporcao = peca.ehVideo ? null : proporcaoDe(peca.largura, peca.altura)
  const posicionamentos = posicionamentosPara(proporcao)

  async function salvarNota() {
    setSalvando(true)
    try {
      await anotarCriativoAction(peca.destino, peca.arquivo, nota)
      setSalvo(true)
      // O aviso some sozinho: um "salvo" permanente vira decoração e para de
      // significar que algo aconteceu agora.
      setTimeout(() => setSalvo(false), 2000)
    } catch {
      toast.error('Não consegui salvar a anotação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <li className="ring-foreground/10 flex flex-col overflow-hidden rounded-xl ring-1">
      {/* `bg-muted` atrás: peça com fundo transparente ou muito clara some
          contra o fundo escuro do painel, e some justamente a parte que a
          pessoa precisa julgar. */}
      <div className="bg-muted relative aspect-square">
        {peca.ehVideo ? (
          // `preload="metadata"`: carrega só o suficiente para o primeiro
          // quadro e a barra de tempo. Com uma dezena de vídeos na tela,
          // `auto` baixaria todos de uma vez.
          <video src={url} controls preload="metadata" className="size-full object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido por rota dinâmica; o otimizador do Next buscaria por HTTP para reprocessar algo que já está no disco
          <img src={url} alt={peca.arquivo} className="size-full object-contain" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="truncate text-sm font-medium" title={peca.arquivo}>
            {peca.arquivo}
          </p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {peca.ehVideo ? 'Vídeo' : `${peca.largura}×${peca.altura}`} ·{' '}
            {peca.peso > 1024 * 1024
              ? `${(peca.peso / 1024 / 1024).toFixed(1)} MB`
              : `${(peca.peso / 1024).toFixed(0)} KB`}
          </p>
        </div>

        {posicionamentos.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {posicionamentos.slice(0, 3).map((p) => (
              <span
                key={p.nome}
                className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-500"
              >
                {p.nome}
              </span>
            ))}
            {posicionamentos.length > 3 && (
              <span className="text-muted-foreground px-1 py-0.5 text-xs">
                +{posicionamentos.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={nota}
              onChange={(e) => {
                setNota(e.target.value)
                setSalvo(false)
              }}
              onBlur={() => nota !== peca.nota && salvarNota()}
              placeholder="Anotar (campanha, resultado…)"
              className="h-9 text-sm"
              aria-label={`Anotação sobre ${peca.arquivo}`}
            />
            {salvando ? (
              <Loader2 aria-hidden className="text-muted-foreground mt-2 size-4 shrink-0 animate-spin" />
            ) : salvo ? (
              <Check aria-hidden className="mt-2 size-4 shrink-0 text-emerald-500" />
            ) : null}
          </div>

          <Button variant="outline" size="sm" render={<a href={url} download={peca.arquivo} />}>
            <Download aria-hidden className="size-4" />
            Baixar
          </Button>
        </div>
      </div>
    </li>
  )
}

/** Exportado para a tela vazia poder listar os dez sem duplicar a lista. */
export { POSICIONAMENTOS }
