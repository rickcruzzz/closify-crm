'use client'

import * as React from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { GoogleIcon } from '@/components/auth/google-icon'
import { PasswordField } from '@/components/auth/password-field'
import { signUpSchema, type SignUpValues } from '@/lib/validations/auth'
import { signUp } from '@/lib/supabase/actions'
import { signInWithGoogleClient } from '@/lib/supabase/google-auth'

export default function SignUpPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', terms: undefined },
  })

  async function onSubmit(values: SignUpValues) {
    setFormError(null)
    setIsSubmitting(true)
    const result = await signUp(values)
    if (result?.error) {
      setFormError(result.error)
      setIsSubmitting(false)
    }
  }

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
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Criar conta</h1>
        </CardTitle>
        <CardDescription>Comece a organizar seu funil de vendas hoje.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">ou</span>
          <Separator className="flex-1" />
        </div>

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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Seu nome"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              disabled={isSubmitting}
              {...register('name')}
            />
            {errors.name && (
              <p id="name-error" role="alert" className="text-destructive text-xs">
                {errors.name.message}
              </p>
            )}
          </div>

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

          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <PasswordField
                id="password"
                label="Senha"
                valor={field.value ?? ''}
                onChange={field.onChange}
                erro={errors.password?.message}
                desabilitado={isSubmitting}
                // Sem `permitirSugestao` aqui: o botão dividia a atenção com o
                // rótulo do campo no momento em que a pessoa está decidindo se
                // cria a conta. O medidor de força fica, porque orienta a
                // escolha sem pedir nenhuma ação.
                mostrarForca
              />
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => (
              <PasswordField
                id="confirmPassword"
                label="Confirmar senha"
                valor={field.value ?? ''}
                onChange={field.onChange}
                erro={errors.confirmPassword?.message}
                desabilitado={isSubmitting}
              />
            )}
          />

          <div className="flex flex-col gap-1.5">
            {/* `mt-0.5` no checkbox: com o texto em `leading-relaxed` e em duas
                linhas, alinhar pelo topo puro deixaria o quadrado acima da
                primeira linha. */}
            <div className="flex items-start gap-2.5">
              <Controller
                name="terms"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="terms"
                    className="mt-0.5 shrink-0"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    aria-invalid={!!errors.terms}
                    aria-describedby={errors.terms ? 'terms-error' : undefined}
                    disabled={isSubmitting}
                  />
                )}
              />
              {/* Os dois documentos precisam ser alcançáveis daqui: aceite de
                  texto que a pessoa não consegue abrir é frágil como prova de
                  consentimento. `target="_blank"` para não perder o formulário
                  já preenchido.

                  `block` anula o `flex items-center gap-2` que o Label do
                  shadcn traz por padrão: em modo flex cada trecho ("Aceito
                  os", cada link, "e a") virava um item separado, quebrando a
                  frase em blocos empilhados e desalinhados. Como bloco, o
                  texto volta a fluir como frase corrida. */}
              <Label
                htmlFor="terms"
                className="text-muted-foreground block text-sm leading-relaxed font-normal"
              >
                Aceito os{' '}
                <Link
                  href="/termos"
                  target="_blank"
                  className="text-foreground underline underline-offset-4"
                >
                  termos de uso
                </Link>{' '}
                e a{' '}
                <Link
                  href="/privacidade"
                  target="_blank"
                  className="text-foreground underline underline-offset-4"
                >
                  política de privacidade
                </Link>
                .
              </Label>
            </div>
            {errors.terms && (
              <p id="terms-error" role="alert" className="text-destructive text-xs">
                {errors.terms.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Criar conta
          </Button>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Já tem uma conta?{' '}
          <Link
            href="/login"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
