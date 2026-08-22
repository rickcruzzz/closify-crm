'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { reportarErro } from '@/lib/erros/reportar'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    reportarErro(error, 'publico')
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      {/* "Algo deu errado" seguido de "ocorreu um erro inesperado" dizia a
          mesma coisa duas vezes e nenhuma delas respondia a única pergunta que
          alguém faz ao ver erro num sistema que guarda a carteira de clientes:
          perdi o que era meu? A resposta vem antes da instrução. */}
      <h1 className="text-2xl font-semibold tracking-tight">
        Esta tela não carregou
      </h1>
      <p className="text-muted-foreground max-w-sm">
        Seus dados estão salvos e seguros. Tente abrir de novo — se continuar
        assim, fale com a gente pelo suporte.
      </p>
      <Button onClick={() => reset()}>Tentar de novo</Button>
    </div>
  )
}
