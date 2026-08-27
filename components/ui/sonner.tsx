'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      /**
       * Fechar a mao, em qualquer toast.
       *
       * A duracao do sonner e GLOBAL: nao da para deixar o erro mais tempo na
       * tela que o sucesso sem tocar nos 69 pontos que chamam `toast.error`.
       * O botao resolve melhor o problema real de qualquer forma — sucesso e
       * confirmacao de algo que a pessoa acabou de fazer e ja ve na tela;
       * erro e a unica copia do que deu errado, e o que ela precisa nao e
       * mais tempo, e sim decidir quando ele sai.
       */
      closeButton
      // 5s, o teto da faixa de 3 a 5 que a auditoria de UX recomenda para
      // aviso temporario. Os 4s padrao sao curtos para um erro de duas linhas.
      duration={5000}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          /* O fundo NAO muda por tipo, de proposito: caixa verde e caixa
             vermelha brigam com a identidade do produto (alto contraste,
             poucos elementos, cartao sobrio). Quem distingue e a barra de
             estado e o icone, em `.cn-toast` no globals.css. Estas linhas
             existem para o sonner nao aplicar o proprio esquema por cima. */
          '--success-bg': 'var(--popover)',
          '--success-text': 'var(--popover-foreground)',
          '--success-border': 'var(--border)',
          '--error-bg': 'var(--popover)',
          '--error-text': 'var(--popover-foreground)',
          '--error-border': 'var(--border)',
          '--warning-bg': 'var(--popover)',
          '--warning-text': 'var(--popover-foreground)',
          '--warning-border': 'var(--border)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
