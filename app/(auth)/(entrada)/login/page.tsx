'use client'

import * as React from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthCabecalho } from '@/components/auth/auth-cabecalho'
import { AuthAlerta } from '@/components/auth/auth-alerta'
import { passo4, passo5 } from '@/components/auth/animacao'
import { loginSchema, type LoginValues } from '@/lib/validations/auth'
import { signIn } from '@/lib/supabase/actions'

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
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

    // Erro DEVOLVIDO ja era tratado. Falta o LANCADO — rede caindo, falha de
    // transporte —, que nao passa por nenhum `if`: `isSubmitting` ficava em
    // `true` para sempre, sem mensagem, e a pessoa nao consegue nem tentar de
    // novo nem entender por que. Mesma classe fechada em 02/09 no cadastro.
    //
    // `catch` e nao `finally`: no sucesso a `signIn` navega, e desligar ali
    // faria o botao acordar no meio da navegacao.
    let result: Awaited<ReturnType<typeof signIn>>
    try {
      result = await signIn(values)
    } catch (err) {
      console.error('signIn rejeitou', err)
      setIsSubmitting(false)
      setFormError('Nao foi possivel entrar agora. Confira sua conexao e tente de novo.')
      return
    }

    if (result?.error) {
      setFormError(result.error)
      setIsSubmitting(false)
    }
  }

  React.useEffect(() => {
    function aoVoltarParaEstaPagina(evento: PageTransitionEvent) {
      if (evento.persisted) {
        setIsSubmitting(false)
      }
    }
    window.addEventListener('pageshow', aoVoltarParaEstaPagina)
    return () => window.removeEventListener('pageshow', aoVoltarParaEstaPagina)
  }, [])

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
              Esqueceu a senha?{' '}
              <Link
                href="/esqueci-senha"
                className="font-medium underline underline-offset-2"
              >
                Recuperar acesso
              </Link>
            </span>
          </AuthAlerta>
        )}

        {/* `method="post"` NÃO é decoração, e a ausência dele vazava a senha.
            Formulário sem `method` faz GET para a própria URL. Antes da
            hidratação — conexão ruim, aparelho lento, chunk demorando — o
            React ainda não instalou o `onSubmit`, o navegador submete
            nativamente, e `{...register('password')}` espalha `name` no input:

                /login?email=vitima%40exemplo.com&password=SenhaSecreta123%21

            A senha fica no histórico do navegador, no `Referer` da navegação
            seguinte e em qualquer log de proxy. Reproduzido em 08/09/2026
            bloqueando o JavaScript.

            O /cadastro está a salvo por ACIDENTE: ele usa `Controller`, cujo
            input não recebe `name`, então não há o que serializar. Refatorar
            aquele formulário para `register` reabre isto lá. */}
        <form
          method="post"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
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

      </div>
    </>
  )
}
