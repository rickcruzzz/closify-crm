'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Erro dentro da área logada.
 *
 * Sem este arquivo, qualquer falha em Pipeline, Leads, Dashboard ou
 * Configurações subia para o `error.tsx` da raiz, que ocupa a tela inteira e
 * substitui o layout: o usuário perdia a barra lateral junto com o conteúdo e
 * ficava sem para onde ir, dependendo do botão de voltar do navegador.
 *
 * Aqui o limite fica DENTRO do layout do dashboard, então a navegação
 * sobrevive ao erro e a pessoa consegue ir para outra tela em vez de ficar
 * presa.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // O `digest` é o identificador que a Vercel usa no log do servidor. Sem
    // ele, um relato de "deu erro na tela de leads" não tem como ser cruzado
    // com a stack real, que o Next não expõe ao browser em produção.
    console.error('Erro na área logada', { digest: error.digest, error })
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span
        aria-hidden
        className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-full"
      >
        <AlertTriangle className="size-5" />
      </span>

      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Não foi possível carregar esta tela
        </h2>
        <p className="text-muted-foreground max-w-sm text-pretty">
          O erro foi registrado. Tente de novo — se continuar, use o menu ao lado para ir
          para outra seção.
        </p>
      </div>

      <Button onClick={reset}>Tentar novamente</Button>

      {error.digest && (
        <p className="text-muted-foreground font-mono text-xs">
          Código do erro: {error.digest}
        </p>
      )}
    </div>
  )
}
