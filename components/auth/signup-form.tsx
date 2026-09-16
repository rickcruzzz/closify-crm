'use client'

import * as React from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { GoogleIcon } from '@/components/auth/google-icon'
import { PasswordField } from '@/components/auth/password-field'
import { FREE_LEAD_LIMIT } from '@/lib/plans'
import { AuthCabecalho } from '@/components/auth/auth-cabecalho'
import { AuthAlerta } from '@/components/auth/auth-alerta'
import { passo3, passo4, passo5 } from '@/components/auth/animacao'
import { signUpSchema, type SignUpValues } from '@/lib/validations/auth'
import { signUp } from '@/lib/supabase/actions'
import { signInWithGoogleClient } from '@/lib/supabase/google-auth'
import { ECO_PADRAO, type EcoDaPeca } from '@/lib/marketing/eco-da-peca'

/**
 * O formulário de criar conta.
 *
 * Recebe a intenção por PROPS, e não lendo `useSearchParams`. A diferença não
 * é de estilo: `useSearchParams` marca a árvore inteira como dinâmica no
 * cliente e obriga uma fronteira de Suspense, e como esta era a página toda,
 * o HTML servido em `/cadastro` não continha formulário nenhum — só o
 * esqueleto do fallback. A página declara `canonical`, ou seja, pede para ser
 * indexada, e entregava ao buscador uma tela vazia. Quem chega de anúncio com
 * rede ruim via a mesma coisa até o JavaScript baixar.
 *
 * Agora quem lê a querystring é o Server Component em `page.tsx`, que já
 * recebe `searchParams` do Next sem custo nenhum, e o formulário chega pronto
 * no HTML.
 */
export function SignUpForm({
  convite,
  plano,
  emailConvidado = '',
  eco,
}: {
  /** Token do convite, quando a pessoa veio de `/convite/[token]`. */
  convite?: string
  /** `'pro'` quando veio do botão "Assinar Pro" da landing. */
  plano?: 'pro'
  /** E-mail já preenchido, quando vem de convite. */
  emailConvidado?: string
  /**
   * O cabeçalho que continua a promessa do anúncio que trouxe a pessoa.
   *
   * Decidido no servidor a partir do `utm_content` — ver
   * `lib/marketing/eco-da-peca.ts`. Ausente para quem não veio de peça
   * conhecida, e aí vale o texto padrão.
   */
  eco?: EcoDaPeca
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  // `convite` e `plano` seguem para a Server Action, que os guarda em cookie:
  // o link do e-mail de confirmação não carrega parâmetro, e sem o cookie a
  // intenção morre na caixa de entrada.

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      // Vindo de convite, o e-mail já vem preenchido: a RPC de aceite recusa
      // endereço diferente do convidado, e deixar digitar outro só adia a
      // frustração para quatro telas depois.
      email: emailConvidado,
      password: '',
      terms: undefined,
      convite,
      plano,
    },
  })

  /**
   * ## Por que o `catch` existe, e por que ele NÃO desliga no caminho feliz
   *
   * Sem ele, uma Server Action que REJEITA (rede caindo no meio do envio,
   * falha de transporte, exceção não tratada no servidor) deixava
   * `isSubmitting` em `true` para sempre com `formError` em `null`: spinner
   * girando, sem mensagem, sem botão clicável. O único caminho era recarregar
   * a página, perdendo o formulário inteiro — no fim de um cadastro de cinco
   * campos, e no exato passo que o anúncio pagou para alcançar.
   *
   * Erro DEVOLVIDO (`{ error }`) já era tratado. O que faltava era o erro
   * LANÇADO, que não passa por nenhum `if`.
   *
   * E não há `finally` de propósito: no sucesso a Server Action redireciona, e
   * desligar o spinner ali faria o botão voltar ao normal por um instante
   * enquanto o navegador ainda está saindo — que lê como "não funcionou" e
   * convida ao segundo clique.
   */
  async function onSubmit(values: SignUpValues) {
    setFormError(null)
    setIsSubmitting(true)
    try {
      const result = await signUp({ ...values, convite, plano })
      if (result?.error) {
        setFormError(result.error)
        setIsSubmitting(false)
      }
    } catch {
      setFormError(
        'Não conseguimos concluir agora. Confira sua conexão e tente de novo, o que você digitou continua aqui.',
      )
      setIsSubmitting(false)
    }
  }

  async function onGoogleClick() {
    setFormError(null)
    setIsGoogleLoading(true)
    try {
      const result = await signInWithGoogleClient()
      if (result?.error) {
        setFormError(result.error)
        setIsGoogleLoading(false)
      }
      // Sem erro: signInWithGoogleClient já redirecionou o browser pro Google.
    } catch {
      setFormError('Não conseguimos abrir o Google agora. Tente de novo em instantes.')
      setIsGoogleLoading(false)
    }
  }

  return (
    <>
      <AuthCabecalho
        variante="pagina"
        titulo={(eco ?? ECO_PADRAO).titulo}
        descricao={(eco ?? ECO_PADRAO).descricao}
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

        {formError && <AuthAlerta>{formError}</AuthAlerta>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className={`${passo4} flex flex-col gap-4`}>
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
          </div>

          <Button type="submit" className={`${passo5} w-full`} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Criar conta
          </Button>
        </form>

        {/* As três objeções que travam a decisão, no lugar onde ela acontece.
            
            A landing responde as três — em `ConfiancaSection`, na `FaqSection`
            e no cartão do Pro. Mas quem chega de anúncio cai DIRETO aqui, e a
            FAQ mora a uns dez mil pixels de distância: registrado como "a
            próxima melhoria de conversão" em 04/09 e nunca feito.

            E o eco de peça só cobre quem vem com `utm_content` conhecido. Duas
            das sete chaves falam de cancelamento; o padrão, nenhuma. Quem chega
            por busca orgânica, indicação ou digitando o endereço não lia uma
            palavra sobre poder sair.

            **Nada aqui é promessa nova.** O Free existe (`FREE_LEAD_LIMIT`), o
            cancelamento pela tela existe, e a exportação em CSV saiu em 03/09.
            Escrever o que o produto não cumpre seria a única coisa pior que o
            silêncio. */}
        <ul
          className={`${passo5} text-muted-foreground flex flex-col gap-1.5 text-center text-xs sm:text-sm`}
        >
          <li>Grátis até {FREE_LEAD_LIMIT} contatos, sem cartão.</li>
          <li>Cancela sozinho, sem multa e sem falar com vendedor.</li>
          <li>Seus contatos saem em CSV quando você quiser.</li>
        </ul>

        <p className={`${passo5} text-muted-foreground text-center text-sm`}>
          Já tem uma conta?{' '}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </>
  )
}
