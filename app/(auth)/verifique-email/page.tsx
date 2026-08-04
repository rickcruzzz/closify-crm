import Link from 'next/link'
import { MailCheck } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function VerifiqueEmailPage() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="bg-primary text-primary-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
          <MailCheck className="size-5" />
        </div>
        <CardTitle className="text-xl">Confirme seu e-mail</CardTitle>
        <CardDescription>
          Enviamos um link de confirmação para o e-mail cadastrado. Clique nele para
          continuar e criar seu workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center text-sm">
          Já confirmou?{' '}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
