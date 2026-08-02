import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function RevealOnScroll({
  children,
  className,
  delay,
}: {
  children: ReactNode
  className?: string
  delay?: string
}) {
  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 ease-out',
        delay,
        className,
      )}
    >
      {children}
    </div>
  )
}
