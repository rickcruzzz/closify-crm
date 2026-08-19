'use client'

import * as React from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2, MailCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthCabecalho } from '@/components/auth/auth-cabecalho'
import { AuthAlerta } from '@/components/auth/auth-alerta'
import { passo4, passo5 } from '@/components/auth/animacao'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/validations/auth'
import { requestPasswordReset } from '@/lib/supabase/actions'

export default function EsqueciSenhaPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    setIsSubmitting(true)
    setFormError(null)
    // Sem try/catch aqui, uma falha de rede entre o clique e a Server Action
    // (não um erro esperado, que `requestPasswordReset` já devolve como
    // `{ error }`, mas a própria chamada rejeitando) deixava `isSubmitting`
    // travado em `true` para sempre — o botão ficava girando sem nenhuma
    // saída, sem mensagem, sem forma de tentar de novo a não ser recarregar
    // a página.
    try {
      const resultado = await requestPasswordReset(values)
      if (resultado?.error) {
        setFormError(resultado.error)
        return
      }
      setSent(true)
    } catch {
      setFormError('Não foi possível enviar o link agora. Tente de novo em instantes.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <Card>
        <AuthCabecalho
          variante="cartao"
          icone={<MailCheck className="size-5" />}
          titulo="Verifique seu e-mail"
          descricao="Se esse e-mail tiver uma conta no Velo Funil, enviamos um link para redefinir sua senha."
        />
        <CardContent className={passo4}>
          <p className="text-muted-foreground text-center text-sm">
            <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
              Voltar para o login
            </Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <AuthCabecalho
        variante="cartao"
        titulo="Esqueceu a senha?"
        descricao="Informe seu e-mail e enviaremos um link para redefinir sua senha."
      />
      <CardContent className="flex flex-col gap-4">
        {formError && <AuthAlerta>{formError}</AuthAlerta>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className={`${passo4} flex flex-col gap-1.5`}>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com.br"
              aria-invalid={!!errors.email}
              disabled={isSubmitting}
              {...register('email')}
            />
            {errors.email && (
              <p role="alert" className="text-destructive text-xs">
                {errors.email.message}
              </p>
            )}
          </div>

          <Button type="submit" className={`${passo5} w-full`} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Enviar link de recuperação
          </Button>
        </form>

        <p className={`${passo5} text-muted-foreground text-center text-sm`}>
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
