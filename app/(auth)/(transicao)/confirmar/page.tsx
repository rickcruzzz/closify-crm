'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AuthCabecalho } from '@/components/auth/auth-cabecalho'
import { AuthCarregando } from '@/components/auth/auth-carregando'
import { passo4 } from '@/components/auth/animacao'
import { createClient } from '@/lib/supabase/client'
import { destinoDoConvite } from '@/lib/supabase/actions'

type Estado = 'aguardando' | 'confirmando' | 'confirmado' | 'erro'

/**
 * Recebe os links de confirmação de cadastro. Dois formatos coexistem:
 *
 * **Novo, em `?token_hash=`**: o botão do e-mail não verifica nada sozinho,
 * só carrega esta página. A verificação (`verifyOtp`) só dispara no clique de
 * "Confirmar e-mail" abaixo. Isso é deliberado: o link antigo (`.ConfirmationURL`
 * do Supabase) verificava o token no próprio GET, e qualquer requisição que
 * visitasse a URL antes da pessoa, antivírus de provedor de e-mail, scanner
 * de link corporativo, o próprio serviço de webmail fazendo preview, consumia
 * o token de uso único primeiro. A pessoa clicava e caía em "link expirado"
 * sem nunca ter tido chance real. Um GET simples nesta página não tem esse
 * efeito colateral; só o clique tem.
 *
 * **Antigo, em `#access_token=`**: e-mails já enviados antes desta mudança
 * continuam apontando para o link do Supabase que devolve a sessão pronta no
 * fragmento da URL, fragmento nunca chega ao servidor, só existe no browser.
 * Mantido por até 24h de e-mails em trânsito; sem ação da pessoa, porque a
 * verificação já aconteceu do lado do Supabase antes do redirect.
 */
export default function ConfirmarPage() {
  return (
    <Suspense fallback={<AuthCarregando rotulo="Carregando…" />}>
      <ConfirmarPageInner />
    </Suspense>
  )
}

function ConfirmarPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [estado, setEstado] = React.useState<Estado>('aguardando')
  const [tokenHash, setTokenHash] = React.useState<string | null>(null)
  const [indoParaDestino, setIndoParaDestino] = React.useState(false)

  async function irParaDestino() {
    setIndoParaDestino(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Convite pendente tem prioridade sobre tudo: a pessoa não veio criar
    // empresa, veio entrar numa que já existe. Sem este desvio ela caía em
    // `/bem-vindo` → `/onboarding` e criava a PRÓPRIA empresa, virando conta
    // separada em vez de colaboradora, com o convite preso em `pending`.
    //
    // O token vem do cookie gravado no cadastro, porque o link do e-mail de
    // confirmação não carrega parâmetro nenhum.
    const convite = await destinoDoConvite()
    if (convite) {
      router.replace(convite)
      return
    }

    if (user) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!membership) {
        router.replace('/bem-vindo')
        return
      }
    }
    router.replace('/dashboard')
  }

  // Fluxo antigo (fragmento), roda sozinho, sem clique, porque o Supabase já
  // verificou o token antes de redirecionar pra cá.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (params.get('error')) {
      setEstado('erro')
      return
    }
    if (!accessToken || !refreshToken) {
      return
    }

    setEstado('confirmando')
    const supabase = createClient()
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setEstado('erro')
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        // Mesma tela de sucesso do fluxo novo: duas experiências diferentes
        // para o mesmo resultado só confundiriam quem recebeu um e-mail antigo.
        setEstado('confirmado')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fluxo novo (query), só guarda o token; a verificação espera o clique.
  React.useEffect(() => {
    const hash = searchParams.get('token_hash')
    if (hash) setTokenHash(hash)
  }, [searchParams])

  async function confirmar() {
    if (!tokenHash) return
    setEstado('confirmando')

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ type: 'signup', token_hash: tokenHash })

    if (error) {
      setEstado('erro')
      return
    }

    // Para aqui de propósito, em vez de redirecionar sozinho.
    //
    // A pessoa acabou de sair do e-mail e precisa de sinal claro de que o
    // clique funcionou. Navegar em silêncio faz parecer que nada aconteceu,
    // é a mesma razão pela qual existe o botão "Confirmar meu e-mail" antes
    // desta etapa.
    setEstado('confirmado')
  }

  // A ORDEM DESTAS CHECAGENS NÃO PODE INVERTER.
  //
  // O fluxo antigo (`#access_token=` no fragmento) chega em `confirmando` e
  // `confirmado` SEM `tokenHash` — a verificação já aconteceu do lado do
  // Supabase antes do redirect. Se a checagem de `!tokenHash` subisse para
  // antes destas duas, todo e-mail no formato antigo cairia direto em "link
  // inválido", sem erro nenhum no console, no meio de um cadastro que
  // funcionou.

  if (estado === 'confirmando') {
    return <AuthCarregando rotulo="Confirmando sua conta…" />
  }

  if (estado === 'confirmado') {
    return (
      <Card>
        <AuthCabecalho
          variante="cartao"
          icone={<CheckCircle2 className="size-5" />}
          titulo="E-mail verificado"
          descricao="Sua conta no Velo Funil está ativa. É só entrar e começar."
        />
        <CardContent className={passo4}>
          <Button
            className="w-full"
            disabled={indoParaDestino}
            onClick={() => void irParaDestino()}
          >
            {indoParaDestino && <Loader2 className="size-4 animate-spin" />}
            Acessar o Velo Funil
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Link consumido/expirado, OU URL incompleta (digitada à mão, cortada por
  // algum cliente de e-mail). Os dois casos eram blocos JSX idênticos copiados
  // em lugares diferentes do arquivo — mesma tela, mesma saída, duas cópias
  // para manter em dia.
  if (estado === 'erro' || !tokenHash) {
    return (
      <Card>
        <AuthCabecalho
          variante="cartao"
          tom="erro"
          icone={<MailWarning className="size-5" />}
          titulo="Link inválido ou expirado"
          descricao="Este link de confirmação já foi usado ou passou da validade. Entre com seu e-mail e senha, se a conta já estiver confirmada, o acesso funciona normalmente."
        />
        <CardContent className={passo4}>
          <Button className="w-full" render={<Link href="/login" />}>
            Ir para o login
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <AuthCabecalho
        variante="cartao"
        titulo="Confirme seu e-mail"
        descricao="Falta só clicar abaixo para ativar sua conta no Velo Funil."
      />
      <CardContent className={passo4}>
        <Button className="w-full" onClick={confirmar}>
          Confirmar meu e-mail
        </Button>
      </CardContent>
    </Card>
  )
}
