import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M12 2a10 10 0 1 0 8.66 15 1.5 1.5 0 0 0-2.6-1.5A7 7 0 1 1 18.86 8.5a1.5 1.5 0 1 0 2.55-1.58A10 10 0 0 0 12 2Z"
      />
    </svg>
  )
}

const sizeClasses = {
  default: 'size-8',
  sm: 'size-7',
} as const

export function Logo({
  size = 'default',
  showWordmark = true,
  className,
}: {
  size?: keyof typeof sizeClasses
  showWordmark?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'bg-primary text-primary-foreground flex shrink-0 items-center justify-center rounded-lg',
          sizeClasses[size],
        )}
      >
        <LogoMark className={size === 'sm' ? 'size-4' : 'size-4.5'} />
      </div>
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight">Closify</span>
      )}
    </div>
  )
}
