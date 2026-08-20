'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import type { DadosDaCentral } from '@/lib/dono/tipos'

import { BlocoDeSaude } from './bloco-de-saude'
import { BlocoDoAnuncio } from './bloco-do-anuncio'
import { Numeros } from './numeros'
import { PrecisaDeAtencao } from './precisa-de-atencao'
import { TabelaDeClientes } from './tabela-de-clientes'

/**
 * A Central do Dono.
 *
 * ## Por que uma página só, rolando, e não abas
 *
 * Aba esconde informação atrás de um clique, e o custo disso numa tela de
 * monitoramento é que o problema fica escondido junto. Este projeto já
 * corrigiu queixa de aba de Configurações parecendo travada — a solução foi
 * dar retorno visual, mas o padrão em si continua sendo trocar navegação por
 * espera. Aqui não há motivo: o conteúdo inteiro cabe numa rolagem, e a ordem
 * dos blocos (o que exige ação primeiro, o resto depois) faz o trabalho que
 * as abas fariam, sem esconder nada.
 *
 * ## Por que o `Toaster` vive aqui
 *
 * Esta rota não usa o layout do produto — que é onde o `Toaster` global mora.
 * Sem esta linha, toda confirmação de ação (Pro liberado, empresa apagada,
 * assinatura corrigida) aconteceria em silêncio.
 */
export function CentralClient({ dados }: { dados: DadosDaCentral }) {
  const router = useRouter()
  const [atualizando, startTransition] = React.useTransition()

  function atualizar() {
    // `router.refresh()` dentro de `useTransition` porque ele é assíncrono: sem
    // o transition, o botão voltaria ao normal antes dos dados novos chegarem,
    // e o clique pareceria não ter feito nada. Mesma correção já aplicada ao
    // seletor de empresa e às abas de Configurações.
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Central do Dono</h1>
          <p className="text-muted-foreground text-sm">
            Tudo do Velo Funil num lugar só. Roda apenas na sua máquina — esta tela não existe
            no ar.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="text-muted-foreground text-xs">
            atualizado {formatarTempoRelativo(dados.lidoEm)}
          </span>
          <Button variant="outline" size="sm" onClick={atualizar} disabled={atualizando}>
            {atualizando ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden className="size-4" />
            )}
            Atualizar
          </Button>
        </div>
      </header>

      {dados.podeEstarCortado && (
        // O PostgREST corta em 1.000 linhas sem avisar. Se alguma busca
        // encostou no teto, os números abaixo são um piso, não o total — e
        // dizer isso é melhor do que mostrar um número errado com cara de certo.
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/5 p-4 text-sm ring-1 ring-amber-500/20">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p className="text-pretty">
            Alguma busca bateu no limite de linhas. Os números abaixo podem estar cortados para
            menos — o total real pode ser maior.
          </p>
        </div>
      )}

      <PrecisaDeAtencao pendencias={dados.pendencias} />
      <Numeros numeros={dados.numeros} dinheiro={dados.dinheiro} />
      <TabelaDeClientes empresas={dados.empresas} />
      <BlocoDoAnuncio anuncio={dados.anuncio} />
      <BlocoDeSaude emails={dados.emails} />

      <Toaster />
    </div>
  )
}
