'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { limparTentativasDeLogin } from '@/lib/supabase/actions'

/** Enquanto o fragmento não foi lido, não dá para saber se o link presta. */
type EstadoDoLink = 'verificando' | 'valido' | 'invalido'

/**
 * Traduz o erro do Supabase para uma frase que diz o que fazer.
 *
 * Antes, três causas diferentes — link velho, sessão ausente e senha recusada
 * pela política — caíam todas em "o link pode ter expirado". Quem tinha sessão
 * ausente pedia link novo para sempre, porque não era esse o problema.
 */
function mensagemDoErro(codigo: string | undefined, mensagem: string): string {
  if (codigo === 'same_password') {
    return 'A nova senha precisa ser diferente da atual.'
  }
  if (codigo === 'weak_password') {
    return 'Senha muito fraca. Use uma senha mais forte.'
  }
  if (
    codigo === 'session_not_found' ||
    codigo === 'refresh_token_not_found' ||
    /session|jwt/i.test(mensagem)
  ) {
    return 'Sua sessão de recuperação expirou. Peça um novo link para redefinir a senha.'
  }
  return 'Não foi possível redefinir a senha. Peça um novo link e tente de novo.'
}

export default function RedefinirSenhaPage() {
  const router = useRouter()
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

  /**
   * A troca roda AQUI, no navegador, e não numa Server Action.
   *
   * A sessão de recuperação nasce neste componente, no `setSession()` acima —
   * o token vem em `#access_token=`, que nunca chega ao servidor. Uma Server
   * Action só a enxergaria depois que o cookie escrito pelo cliente voltasse
   * numa requisição nova, e essa travessia era a única etapa da cadeia que não
   * dava para observar de fora. Era também onde o `PUT /user` sumia: nos logs
   * apareciam vários `POST /recover` e nenhuma troca de senha concluída.
   *
   * Aqui a chamada acontece no mesmo lugar onde a sessão acabou de nascer, e
   * qualquer erro chega à tela com o código real em vez de virar silêncio.
   */
  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.updateUser({ password: values.password })

    if (error) {
      console.error('updateUser (reset de senha) falhou', {
        code: error.code,
        status: error.status,
      })
      setFormError(mensagemDoErro(error.code, error.message))
      setIsSubmitting(false)
      return
    }

    // Quem redefine a senha costuma estar reagindo a uma conta invadida. Sem
    // isto o invasor continua logado nos aparelhos dele: trocar a senha não
    // derruba sessão nenhuma por conta própria.
    //
    // `others` e não `global`: revoga os outros refresh tokens e preserva a
    // sessão atual, que é o que permite cair no dashboard já autenticado.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })

    if (signOutError) {
      // A senha JÁ mudou — não dá para desfazer, e seguir em silêncio faria a
      // pessoa acreditar que os outros aparelhos foram desconectados.
      console.error('signOut das outras sessões falhou após reset', signOutError)
      setFormError(
        'Sua senha foi alterada, mas não conseguimos desconectar os outros dispositivos. Se suspeita de acesso indevido, troque a senha de novo em instantes.',
      )
      setIsSubmitting(false)
      return
    }

    // Provou posse da conta: não deve carregar o bloqueio das tentativas de
    // login erradas que antecederam o reset. Falhar aqui não pode travar
    // ninguém — a senha já está trocada e o acesso, garantido.
    try {
      if (data.user?.email) await limparTentativasDeLogin(data.user.email)
    } catch (err) {
      console.error('limparTentativasDeLogin falhou após reset', err)
    }

    // `refresh` antes de navegar: o cookie de sessão acabou de mudar e o
    // dashboard é renderizado no servidor — sem isso ele poderia ser servido
    // com o estado anterior.
    router.refresh()
    router.replace('/dashboard')
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
