'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-muted-foreground text-sm font-medium">Erro</p>
      <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
      <p className="text-muted-foreground max-w-sm">
        Ocorreu um erro inesperado. Tente novamente ou volte mais tarde.
      </p>
      <Button onClick={() => reset()}>Tentar novamente</Button>
    </div>
  )
}
