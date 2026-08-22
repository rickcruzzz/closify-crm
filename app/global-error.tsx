'use client'

import { useEffect } from 'react'

import { reportarErro } from '@/lib/erros/reportar'

/**
 * Último recurso: erro no PRÓPRIO layout raiz.
 *
 * O `app/error.tsx` só cobre o que está DENTRO do layout. Se o layout raiz
 * falhar, provider de tema, carregamento de fonte, qualquer coisa antes das
 * páginas, não havia fallback nenhum e o visitante recebia a tela de erro
 * crua do navegador.
 *
 * Por substituir o layout raiz, este arquivo precisa trazer as próprias tags
 * `html` e `body`. Também não pode depender de nada do app: sem componentes,
 * sem tokens de tema, sem Tailwind, se o layout quebrou, o CSS pode não ter
 * carregado. Daí o estilo inline, que é feio de propósito e funciona sempre.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erro no layout raiz', { digest: error.digest, error })
    reportarErro(error, 'global')
  }, [error])

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          background: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
          O Velo Funil não abriu
        </h1>
        <p style={{ color: '#a1a1a1', maxWidth: '28rem', margin: 0, lineHeight: 1.6 }}>
          Seus dados estão salvos e seguros — a falha foi ao carregar a tela.
          Recarregue a página; se continuar, fale com a gente pelo suporte.
        </p>
        <button
          onClick={reset}
          style={{
            minHeight: '44px',
            padding: '0 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#fafafa',
            color: '#0a0a0a',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
        {error.digest && (
          <p style={{ color: '#6b6b6b', fontSize: '0.75rem', margin: 0 }}>
            Código do erro: {error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
