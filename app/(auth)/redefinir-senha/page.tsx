'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordField } from '@/components/auth/password-field'
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/validations/auth'
import { updatePassword } from '@/lib/supabase/actions'

export default function RedefinirSenhaPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

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
