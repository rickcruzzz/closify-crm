'use client'

import * as React from 'react'

/**
 * Lê uma media query no cliente. Começa em `false` no primeiro render para
 * casar com o HTML do servidor (que não conhece a viewport) e só então
 * sincroniza, assim não há mismatch de hidratação.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const list = window.matchMedia(query)
    setMatches(list.matches)

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}
