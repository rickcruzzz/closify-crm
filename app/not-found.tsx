import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-muted-foreground text-sm font-medium">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="text-muted-foreground max-w-sm">
        A página que você está procurando não existe ou foi movida.
      </p>
      <Button render={<Link href="/">Voltar para o início</Link>} />
    </div>
  )
}
