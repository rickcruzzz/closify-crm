'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, MailWarning } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

/**
 * Recebe os links de autenticação que voltam com a sessão no FRAGMENTO da URL
 * (`#access_token=...`) — hoje, a confirmação de cadastro.
 *
 * Fragmento não é enviado ao servidor: nem Route Handler nem Server Component
 * conseguem lê-lo. O `/auth/callback` só enxerga `?code=`, então a confirmação
 * de e-mail caía no `redirect('/login')` mesmo com sessão válida em mãos. Na
 * prática: a pessoa clicava no link do e-mail, a conta era ativada, e ela
 * aterrissava na tela de login sem estar logada — precisando digitar a senha
 * que acabara de criar. Perda de conversão logo depois do cadastro.
 *
 * Esta página roda no browser, que é o único lugar onde o fragmento existe.
 */
export default function ConfirmarPage() {
  const router = useRouter()
  const [erro, setErro] = React.useState(false)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))

    if (params.get('error')) {
      setErro(true)
      return
    }

    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      setErro(true)
      return
    }

    const supabase = createClient()
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setErro(true)
          return
        }
        // Tira o token da barra de endereços antes de navegar: ele dá acesso à
        // conta e não deveria sobreviver no histórico nem num print de tela.
        window.history.replaceState(null, '', window.location.pathname)
        // `/dashboard` decide o destino final — manda para `/onboarding` se
        // ainda não houver empresa. Concentrar essa regra num lugar só evita
        // duas fontes de verdade sobre "para onde vai quem acabou de entrar".
        router.replace('/dashboard')
      })
  }, [router])

  if (erro) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="bg-destructive/10 text-destructive mb-2 flex size-10 items-center justify-center rounded-lg">
            <MailWarning className="size-5" />
          </div>
          <CardTitle className="text-xl">Link inválido ou expirado</CardTitle>
          <CardDescription>
            Este link de confirmação já foi usado ou passou da validade. Entre com seu
            e-mail e senha — se a conta já estiver confirmada, o acesso funciona
            normalmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" render={<Link href="/login" />}>
            Ir para o login
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3">
        <Loader2 aria-hidden className="size-5 animate-spin" />
        <p className="text-muted-foreground text-sm">Confirmando sua conta...</p>
      </CardContent>
    </Card>
  )
}
