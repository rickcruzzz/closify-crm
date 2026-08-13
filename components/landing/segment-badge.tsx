'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'

import { Badge } from '@/components/ui/badge'

const TEXTO_PADRAO = 'Feito para PMEs de serviço'

/**
 * Mesmos valores de `SEGMENTOS` em lib/validations/onboarding.ts — reaproveita
 * a taxonomia que o produto já usa, em vez de inventar uma nova pro anúncio.
 */
const ROTULOS_POR_SEGMENTO: Record<string, string> = {
  clinica: 'Feito para clínicas',
  imobiliaria: 'Feito para imobiliárias',
  agencia: 'Feito para agências',
  consultoria: 'Feito para consultorias',
  academia: 'Feito para academias',
  restaurante: 'Feito para restaurantes',
}

/**
 * Message match: quem clica num anúncio segmentado por nicho ("CRM pra
 * clínica", "CRM pra imobiliária") espera ver essa palavra confirmada na
 * primeira dobra. `?segmento=` na URL do anúncio troca o badge sem mudar mais
 * nada na página — sem parâmetro reconhecido, cai no texto genérico de hoje.
 *
 * Client component + Suspense própria, mesmo padrão de
 * components/landing/utm-capture.tsx: mantém a rota estática (SSG), o texto
 * só troca depois da hidratação.
 */
function BadgeInterno({ className }: { className?: string }) {
  const searchParams = useSearchParams()
  const segmento = searchParams.get('segmento')
  const texto = (segmento && ROTULOS_POR_SEGMENTO[segmento]) || TEXTO_PADRAO

  return (
    <Badge variant="secondary" className={className}>
      {texto}
    </Badge>
  )
}

export function SegmentBadge({ className }: { className?: string }) {
  return (
    <React.Suspense
      fallback={
        <Badge variant="secondary" className={className}>
          {TEXTO_PADRAO}
        </Badge>
      }
    >
      <BadgeInterno className={className} />
    </React.Suspense>
  )
}
