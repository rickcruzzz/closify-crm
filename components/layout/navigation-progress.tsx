'use client'

import * as React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// O layout do dashboard faz `await` de várias consultas antes de devolver
// qualquer JSX, sem `<Suspense>` ao redor, então nenhum `loading.tsx` de
// rota aparece enquanto isso não resolve. Sem NENHUM sinal entre o clique e a
// tela nova, a pessoa acha que não clicou e clica de novo. Esta barra liga no
// clique real (delegação de evento, não estado de nenhum link específico) e
// desliga quando a rota de fato muda, não é um timer fingindo progresso.
function BarraDeProgresso() {
  const [navegando, setNavegando] = React.useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  React.useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      if (evento.defaultPrevented || evento.button !== 0) return
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return

      const alvo = (evento.target as HTMLElement | null)?.closest('a')
      if (!alvo) return
      if (alvo.target === '_blank' || alvo.hasAttribute('download')) return

      const href = alvo.getAttribute('href')
      if (!href || href.startsWith('#')) return

      let destino: URL
      try {
        destino = new URL(href, window.location.href)
      } catch {
        return
      }

      // Link externo sai da página, não há rota interna pra "progredir".
      if (destino.origin !== window.location.origin) return
      // Mesmo destino de onde já se está: não é navegação.
      if (destino.pathname === window.location.pathname && destino.search === window.location.search) {
        return
      }

      setNavegando(true)
    }

    document.addEventListener('click', aoClicar)
    return () => document.removeEventListener('click', aoClicar)
  }, [])

  // Dispara quando a navegação de fato termina (URL nova já aplicada, RSC
  // payload já montado), é o sinal real de "chegou", não um prazo fixo.
  React.useEffect(() => {
    setNavegando(false)
  }, [pathname, searchParams])

  if (!navegando) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div className="bg-primary animate-pulse h-full w-full" />
    </div>
  )
}

export function NavigationProgress() {
  return (
    <React.Suspense fallback={null}>
      <BarraDeProgresso />
    </React.Suspense>
  )
}
