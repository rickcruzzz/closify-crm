import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

function EmptyState({
  icon: Icon,
  title,
  description,
  size = 'default',
  className,
  children,
}: {
  icon: LucideIcon
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
