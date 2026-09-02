'use client'

import * as React from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { GoogleIcon } from '@/components/auth/google-icon'
import { AuthCabecalho } from '@/components/auth/auth-cabecalho'
import { AuthAlerta } from '@/components/auth/auth-alerta'
import { passo3, passo4, passo5 } from '@/components/auth/animacao'
import { loginSchema, type LoginValues } from '@/lib/validations/auth'
import { signIn } from '@/lib/supabase/actions'
import { signInWithGoogleClient } from '@/lib/supabase/google-auth'

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    setIsSubmitting(true)
    const result = await signIn(values)
    if (result?.error) {
      setFormError(result.error)
      setIsSubmitting(false)
    }
  }

  /**
   * Desliga o spinner do Google quando a pessoa VOLTA da tela de escolha.
   *
   * ## O defeito, e por que ele nasceu junto com a correcao
   *
   * `onGoogleClick` liga `isGoogleLoading` e nunca o desliga no caminho de
   * sucesso — de proposito, porque o navegador estaria saindo para o Google e
   * resetar deixaria o botao "acordar" no meio da navegacao.
   *
   * Isso valia enquanto o Google entrava DIRETO. Com `prompt=select_account`
   * passou a existir uma tela de escolha, e com ela o botao voltar: quem
   * desiste ali volta para `/login` e encontra o botao girando para sempre.
   *
   * A correcao anterior criou a oportunidade para este defeito. Vale registrar
   * porque e o padrao: mudanca que acrescenta um passo ao fluxo acrescenta
   * junto todos os caminhos de saida desse passo.
   *
   * ## Por que `pageshow` com `persisted`, e nao `useEffect` de montagem
   *
   * A pagina volta do **bfcache** do navegador, com a arvore React inteira
   * preservada — estado incluso. Nao ha remontagem, entao um `useEffect([])`
   * nao roda de novo e o `useState(false)` inicial nunca e reavaliado.
   *
   * `pageshow` dispara nos dois casos, e `event.persisted` distingue: `true`
   * significa que veio do bfcache, que e exatamente o caso em que o estado
   * sobreviveu e precisa ser desfeito. Numa recarga de verdade o estado ja
   * nasce limpo e nao ha o que fazer.
   */
  React.useEffect(() => {
    function aoVoltarParaEstaPagina(evento: PageTransitionEvent) {
      if (evento.persisted) {
        setIsGoogleLoading(false)
        // `isSubmitting` pelo mesmo motivo: o login por senha termina em
        // `redirect()`, e voltar dele cairia no mesmo botao travado.
        setIsSubmitting(false)
      }
    }
    window.addEventListener('pageshow', aoVoltarParaEstaPagina)
    return () => window.removeEventListener('pageshow', aoVoltarParaEstaPagina)
  }, [])

  async function onGoogleClick() {
    setFormError(null)
    setIsGoogleLoading(true)
    const result = await signInWithGoogleClient()
    if (result?.error) {
      setFormError(result.error)
      setIsGoogleLoading(false)
    }
    // Sem erro: signInWithGoogleClient já redirecionou o browser pro Google.
  }

  return (
    <>
      {/* "empresa", não "workspace": o termo é jargão de software e o público
          é dono de agência, clínica e imobiliária pequena. A troca está
          definida em docs/prd-copy-sem-jargao.md e vale para o produto todo,
          não só para a landing. */}
      <AuthCabecalho
        variante="pagina"
        titulo="Entrar"
        descricao="Acesse o painel da sua empresa."
      />

      <div className="mt-8 flex flex-col gap-4">
        <div className={passo3}>
          <Button
            variant="outline"
            className="w-full"
            type="button"
            disabled={isSubmitting || isGoogleLoading}
            onClick={onGoogleClick}
          >
            {isGoogleLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GoogleIcon className="size-4" />
            )}
            Continuar com Google
          </Button>

          <div className="mt-4 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">ou</span>
            <Separator className="flex-1" />
          </div>
        </div>

        {/* A mensagem é a mesma para senha errada e para e-mail sem conta, de
            propósito: distinguir as duas permitiria testar uma lista de
            endereços e descobrir quem tem conta no Velo Funil, insumo direto
            para phishing dirigido.

            Mas a dúvida de quem errou é legítima ("não tenho conta ou errei a
            senha?"), e antes ela ficava sem saída. Os dois caminhos abaixo
            resolvem sem responder a pergunta a quem está sondando. */}
        {formError && (
          <AuthAlerta className="flex flex-col gap-2">
            <span>{formError}</span>
            <span className="text-destructive/90 text-xs">
              Ainda não tem conta?{' '}
              <Link href="/cadastro" className="font-medium underline underline-offset-2">
                Criar conta grátis
              </Link>{' '}
              · Esqueceu a senha?{' '}
              <Link
                href="/esqueci-senha"
                className="font-medium underline underline-offset-2"
              >
                Recuperar acesso
              </Link>
            </span>
          </AuthAlerta>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className={`${passo4} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@empresa.com.br"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                disabled={isSubmitting}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-destructive text-xs">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {/* `-my-3 py-3` leva o link a 44px de alvo sem mexer no
                    espaçamento visual: o padding cresce a área de toque e a
                    margem negativa devolve o espaço ao layout. */}
                <Link
                  href="/esqueci-senha"
                  className="text-muted-foreground hover:text-foreground -my-3 py-3 text-xs underline-offset-4 hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                disabled={isSubmitting}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-destructive text-xs">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <Button type="submit" className={`${passo5} w-full`} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className={`${passo5} text-muted-foreground text-center text-sm`}>
          Não tem uma conta?{' '}
          <Link href="/cadastro" className="text-foreground underline-offset-4 hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </>
  )
}
