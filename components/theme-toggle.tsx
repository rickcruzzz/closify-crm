'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'

// 48px de alvo de toque no celular, 32 no desktop.
//
// Compartilhado entre a landing e o cabeçalho de dentro do app. Os 4px a mais
// cabem nos dois: a barra do app é `h-14` (56px). Deixar tamanhos diferentes
// nos dois lugares seria pior do que os 4px.
const ALVO_DE_TOQUE = 'size-12 md:size-8'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Alternar tema"
        className={ALVO_DE_TOQUE}
      />
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema"
      className={ALVO_DE_TOQUE}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  )
}
