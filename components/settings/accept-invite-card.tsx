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

  // O token viaja junto para o cadastro e para o login.
  //
  // Sem ele, a pessoa convidada cadastrava, confirmava o e-mail, caía em
  // `/onboarding` e criava a PRÓPRIA empresa, entrava como conta separada em
  // vez de colaborador, e o convite ficava `pending` para sempre no painel de
  // quem convidou. O e-mail também vai, para o formulário já vir preenchido:
  // a RPC de aceite recusa endereço diferente do convidado, e descobrir isso
  // quatro telas depois é frustração garantida.
  const paraCadastro = `/cadastro?convite=${encodeURIComponent(token)}&email=${encodeURIComponent(inviteEmail)}`
  const paraLogin = `/login?convite=${encodeURIComponent(token)}`

  async function handleAccept() {
    setIsSubmitting(true)
    setError(null)
    const result = await acceptInvite(token)
    setIsSubmitting(false)

    if (result?.error === 'not_authenticated') {
      router.push(paraCadastro)
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
          Você foi convidado para colaborar na empresa <strong>{workspaceName}</strong> no
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
            Crie sua conta com {inviteEmail} para entrar na equipe. Assim que confirmar o
            e-mail, você já cai direto aqui dentro.
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
          <Button className="w-full" render={<Link href={paraCadastro}>Criar conta</Link>} />
        )}
        <p className="text-muted-foreground text-center text-sm">
          <Link href={paraLogin} className="text-foreground underline-offset-4 hover:underline">
            Já tenho conta, fazer login
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
