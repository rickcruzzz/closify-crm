'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { ArrowRight, Check, Loader2, PartyPopper } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordField } from '@/components/auth/password-field'
import { definirSenhaInicial } from '@/lib/supabase/actions'
import { pularOnboarding } from '@/lib/onboarding/actions'
import {
  definirSenhaSchema,
  type DefinirSenhaValues,
} from '@/lib/validations/auth'

export function BemVindoClient({
  primeiroNome,
  email,
  podeDefinirSenha,
  retomando,
}: {
  primeiroNome: string | null
  email: string
  podeDefinirSenha: boolean
  /** Já tinha começado o assistente e voltou depois. */
  retomando: boolean
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [pulando, setPulando] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  // A senha só aparece quando a pessoa pede: abrir a tela já com dois campos
  // de senha contradiz a promessa do "entrar com Google", que é justamente
  // não ter que criar uma.
  const [mostrandoSenha, setMostrandoSenha] = React.useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DefinirSenhaValues>({
    resolver: zodResolver(definirSenhaSchema),
    defaultValues: { password: '', confirmPassword: '', email },
  })

  async function onSubmit(values: DefinirSenhaValues) {
    setFormError(null)
    setIsSubmitting(true)

    const result = await definirSenhaInicial(values)
    if (result?.error) {
      setFormError(result.error)
      setIsSubmitting(false)
      return
    }

    toast.success('Senha criada. Agora você pode entrar das duas formas.')
    router.push('/onboarding')
  }

  async function pular() {
    setPulando(true)
    const resultado = await pularOnboarding()

    if ('error' in resultado) {
      toast.error(resultado.error)
      setPulando(false)
      return
    }

    router.push('/dashboard')
  }

  const ocupado = isSubmitting || pulando

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="bg-primary text-primary-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
          <PartyPopper className="size-5" />
        </div>
        <CardTitle className="text-xl">
          {retomando
            ? 'Vamos continuar de onde você parou'
            : primeiroNome
              ? `Bem-vindo ao Velo Funil, ${primeiroNome}!`
              : 'Bem-vindo ao Velo Funil!'}
        </CardTitle>
        <CardDescription>
          {retomando ? (
            <>Sua configuração ficou pela metade. Retomamos no ponto exato.</>
          ) : (
            <>
              Sua conta foi criada com <span className="text-foreground">{email}</span>.
              Vamos preparar seu ambiente de vendas — leva cerca de 2 minutos.
            </>
          )}
        </CardDescription>
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

        {podeDefinirSenha && !mostrandoSenha && (
          <div className="bg-muted/40 flex flex-col gap-3 rounded-lg p-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Quer criar uma senha?</span>
              <span className="text-muted-foreground text-sm">
                Assim você entra com e-mail e senha também, sem depender da sua conta
                Google. Dá para fazer isso depois, nas configurações.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setMostrandoSenha(true)}
            >
              Criar uma senha
            </Button>
          </div>
        )}

        {podeDefinirSenha && mostrandoSenha && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Salvar senha e continuar
            </Button>
          </form>
        )}

        {/* Sempre visível: seguir sem senha é um caminho legítimo, não uma
            saída escondida. Quem entrou pelo Google continua entrando por ele. */}
        <Button
          type="button"
          variant={mostrandoSenha ? 'ghost' : 'default'}
          className="w-full"
          disabled={ocupado}
          onClick={() => router.push('/onboarding')}
        >
          {retomando
            ? 'Continuar de onde parei'
            : podeDefinirSenha && mostrandoSenha
              ? 'Continuar sem senha'
              : 'Começar configuração'}
          <ArrowRight className="size-4" />
        </Button>

        {/* Pular é oferta de verdade, não armadilha: não bloqueia nada, guarda
            o que já foi respondido, e não volta a aparecer a cada login. Sem
            uma saída visível, o assistente vira pedágio. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full"
          disabled={ocupado}
          onClick={pular}
        >
          {pulando && <Loader2 className="size-4 animate-spin" />}
          Pular por enquanto
        </Button>
      </CardContent>
    </Card>
  )
}
