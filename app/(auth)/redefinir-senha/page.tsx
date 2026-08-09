'use client'

import * as React from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2, MailWarning } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordField } from '@/components/auth/password-field'
import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/validations/auth'
import { updatePassword } from '@/lib/supabase/actions'

/** Enquanto o fragmento não foi lido, não dá para saber se o link presta. */
type EstadoDoLink = 'verificando' | 'valido' | 'invalido'

export default function RedefinirSenhaPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [estadoDoLink, setEstadoDoLink] = React.useState<EstadoDoLink>('verificando')

  /**
   * O link de recuperação devolve a sessão em `#access_token=...`.
   *
   * Fragmento de URL não é enviado ao servidor — nem Server Component nem
   * Route Handler conseguem lê-lo. Por isso a troca acontece aqui, no browser,
   * que é o único lugar onde esses valores existem.
   *
   * O mesmo fragmento carrega o caminho de erro (`#error=access_denied&
   * error_code=otp_expired`), que é o que aparece quando o link já foi aberto
   * antes — inclusive pelo antivírus do provedor de e-mail, que visita URLs
   * automaticamente e consome o token de uso único sem ninguém clicar.
   */
  React.useEffect(() => {
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)

    if (params.get('error')) {
      setEstadoDoLink('invalido')
      return
    }

    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      // Sem fragmento: ou a pessoa digitou a URL na mão, ou já existe sessão
      // de recuperação estabelecida (por exemplo, ao recarregar a página).
      const supabase = createClient()
      supabase.auth.getSession().then(({ data }) => {
        setEstadoDoLink(data.session ? 'valido' : 'invalido')
      })
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(
      ({ error }) => {
        setEstadoDoLink(error ? 'invalido' : 'valido')
        // Tira o token da barra de endereços: ele dá acesso à conta e não
        // deveria sobreviver no histórico do navegador nem em um print.
        window.history.replaceState(null, '', window.location.pathname)
      },
    )
  }, [])

  const {
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    // `confirmPassword` precisa nascer aqui: o schema exige o campo, e sem ele
    // no defaultValues o resolver falhava com `undefined` num campo que a tela
    // nem renderizava — o erro não tinha onde aparecer e o submit nunca
    // disparava, deixando o botão "Salvar nova senha" inerte.
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null)
    setIsSubmitting(true)
    const result = await updatePassword(values)
    if (result?.error) {
      setFormError(result.error)
      setIsSubmitting(false)
    }
  }

  if (estadoDoLink === 'verificando') {
    return (
      <Card>
        <CardContent className="flex min-h-40 items-center justify-center">
          <Loader2 aria-label="Verificando o link" className="size-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  // Link já usado ou expirado. Antes isso caía em `/login` com o erro cru na
  // barra de endereços (`error_code=otp_expired`), sem nenhuma explicação e
  // sem saída — a pessoa via só a tela de entrar e não entendia o motivo.
  if (estadoDoLink === 'invalido') {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="bg-destructive/10 text-destructive mb-2 flex size-10 items-center justify-center rounded-lg">
            <MailWarning className="size-5" />
          </div>
          <CardTitle className="text-xl">Link expirado</CardTitle>
          <CardDescription>
            Este link de redefinição já foi usado ou passou da validade. Peça um novo —
            ele vale por uma hora e só funciona uma vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button className="w-full" render={<Link href="/esqueci-senha" />}>
            Pedir novo link
          </Button>
          <Button variant="ghost" className="w-full" render={<Link href="/login" />}>
            Voltar para o login
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Redefinir senha</CardTitle>
        <CardDescription>Escolha uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {formError && (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
          >
            {formError}
          </p>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <PasswordField
                id="password"
                label="Nova senha"
                valor={field.value ?? ''}
                onChange={field.onChange}
                // Mesma regra do cadastro: a senha sugerida preenche a
                // confirmação junto, porque redigitar 16 caracteres aleatórios
                // que a pessoa não escolheu só geraria erro de digitação.
                onSugerir={(senha) =>
                  setValue('confirmPassword', senha, { shouldValidate: true })
                }
                erro={errors.password?.message}
                desabilitado={isSubmitting}
                mostrarForca
                permitirSugestao
              />
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => (
              <PasswordField
                id="confirmPassword"
                label="Confirmar nova senha"
                valor={field.value ?? ''}
                onChange={field.onChange}
                erro={errors.confirmPassword?.message}
                desabilitado={isSubmitting}
              />
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Salvar nova senha
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
