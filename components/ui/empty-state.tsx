import type { ComponentType, SVGProps } from 'react'

import { cn } from '@/lib/utils'

function EmptyState({
  icon: Icon,
  title,
  description,
  size = 'default',
  className,
  children,
}: {
  /**
   * Aceita qualquer componente de SVG, e nao so `LucideIcon`.
   *
   * O tipo estreito recusava `IconeWhatsapp`, que e um SVG proprio porque o
   * lucide nao carrega marcas. Alargar aqui e o mesmo que ja foi feito no
   * cartao de plano da landing: a tela vazia do WhatsApp precisa do glifo
   * real, e nao de um balao generico igual ao de "Conversas".
   */
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description?: string
  size?: 'default' | 'sm'
  className?: string
  children?: React.ReactNode
}) {
  const isSmall = size === 'sm'

  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isSmall ? 'gap-2 py-6' : 'gap-3 py-10',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full',
          isSmall ? 'size-8' : 'size-11',
        )}
      >
        <Icon className={isSmall ? 'size-4' : 'size-5'} />
      </span>

      <div className="flex flex-col gap-1">
        <p className={cn('font-medium', isSmall && 'text-sm')}>{title}</p>
        {description && (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm text-pretty">
            {description}
          </p>
        )}
      </div>

      {children && (
        <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>
      )}
    </div>
  )
}

export { EmptyState }
