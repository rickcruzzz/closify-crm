'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'

import { capturarUtm } from '@/lib/auth/utm-actions'

/**
 * Sem UI — só olha a URL do primeiro carregamento atrás de `utm_*` e manda
 * pro cookie de atribuição (lib/auth/intencao.ts), que persiste pra dentro
 * do workspace quando a conta é criada. Cookie próprio, primeira parte
 * (first-party), sem rede pra terceiro — não é o mesmo tipo de rastreamento
 * do Meta Pixel, é o produto lembrando de onde a própria visita veio.
 */
function CapturaInterna() {
  const searchParams = useSearchParams()
  const jaEnviou = React.useRef(false)

  React.useEffect(() => {
    if (jaEnviou.current) return

    const source = searchParams.get('utm_source')
    const medium = searchParams.get('utm_medium')
    const campaign = searchParams.get('utm_campaign')

    if (!source && !medium && !campaign) return

    jaEnviou.current = true
    void capturarUtm({
      source: source ?? undefined,
      medium: medium ?? undefined,
      campaign: campaign ?? undefined,
    })
  }, [searchParams])

  return null
}

export function UtmCapture() {
  // `useSearchParams` exige fronteira de Suspense própria em página estática
  // — sem isso o build reclama que a rota inteira precisaria virar dinâmica.
  return (
    <React.Suspense fallback={null}>
      <CapturaInterna />
    </React.Suspense>
  )
}
