'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { acceptInvite } from '@/lib/workspace/actions'

export function AcceptInviteCard({
  token,
  workspaceName,
  inviteEmail,
  isAuthenticated,
  userEmail,
}: {
  token: string
  workspaceName: string
  inviteEmail: string
  isAuthenticated: boolean
  userEmail?: string
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const wrongAccount = isAuthenticated && userEmail !== inviteEmail

  async function handleAccept() {
    setIsSubmitting(true)
    setError(null)
    const result = await acceptInvite(token)
    setIsSubmitting(false)

    if (result?.error === 'not_authenticated') {
      router.push('/cadastro')
      return
    }
    if (result?.error) {
      setError(result.error)
      return
    }
    router.push('/dashboard')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Convite para {workspaceName}</CardTitle>
        <CardDescription>
          Você foi convidado para colaborar no workspace <strong>{workspaceName}</strong> no
          Velo Funil, com o e-mail {inviteEmail}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {wrongAccount && (
          <p className="text-destructive text-sm">
            Você está logado com outra conta ({userEmail}). Saia e entre com {inviteEmail} para
            aceitar este convite.
          </p>
        )}
        {!isAuthenticated && (
          <p className="text-muted-foreground text-sm">
            Crie uma conta ou faça login com {inviteEmail} e volte a este link para aceitar.
          </p>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {isAuthenticated ? (
          <Button
            className="w-full"
            onClick={handleAccept}
            disabled={isSubmitting || wrongAccount}
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Aceitar convite
          </Button>
        ) : (
          <Button className="w-full" render={<Link href="/cadastro">Criar conta</Link>} />
        )}
        <p className="text-muted-foreground text-center text-sm">
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Já tenho conta, fazer login
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
