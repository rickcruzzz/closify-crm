'use client'

import * as React from 'react'
import Link from 'next/link'

import { useDestinoComOrigem } from '@/components/landing/usar-destino-com-origem'

/**
 * O CTA do corpo das páginas de conteúdo, levando adiante de onde a visita veio.
 *
 * A regra inteira — e as duas medições que a produziram — mora em
 * `useDestinoComOrigem`. Aqui é só o `Link`.
 */
export function LinkComOrigem({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={useDestinoComOrigem(href)} className={className}>
      {children}
    </Link>
  )
}
