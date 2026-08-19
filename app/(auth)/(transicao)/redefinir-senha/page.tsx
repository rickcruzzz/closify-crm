'use client'

import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2, MailWarning, PartyPopper } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordField } from '@/components/auth/password-field'
import { AuthCabecalho } from '@/components/auth/auth-cabecalho'
import { AuthAlerta } from '@/components/auth/auth-alerta'
import { AuthCarregando } from '@/components/auth/auth-carregando'
import { passo4 } from '@/components/auth/animacao'
import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/validations/auth'
import { limparTentativasDeLogin } from '@/lib/supabase/actions'

/** ~1800ms dá tempo de ler "Bem-vindo de volta" sem parecer trava. */
const ESPERA_ANTES_DO_DASHBOARD_MS = 1800
/** Com `prefers-reduced-motion`, a pessoa não quer esperar animação nenhuma. */
const ESPERA_REDUZIDA_MS = 300

/**
 * 'token-pendente': novo formato do e-mail (`?token_hash=`), token ainda não
 * verificado, a verificação só dispara no submit do formulário, não no
 * carregamento da página (ver comentário no efeito abaixo).
 * 'sessao-pronta': sessão de recuperação já existe (formato antigo por
 * fragmento, já verificado pelo Supabase antes do redirect).
 */
type EstadoDoLink = 'verificando' | 'sessao-pronta' | 'token-pendente' | 'invalido' | 'sucesso'

/**
 * Traduz o erro do Supabase para uma frase que diz o que fazer.
 *
 * Antes, três causas diferentes, link velho, sessão ausente e senha recusada
 * pela política, caíam todas em "o link pode ter expirado". Quem tinha sessão
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
  return (
    <Suspense fallback={<AuthCarregando rotulo="Verificando o link…" />}>
      <RedefinirSenhaPageInner />
    </Suspense>
  )
}

function RedefinirSenhaPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [estadoDoLink, setEstadoDoLink] = React.useState<EstadoDoLink>('verificando')
  const [primeiroNome, setPrimeiroNome] = React.useState('')

  /**
   * Dois formatos de link coexistem.
   *
   * **Novo, em `?token_hash=`**: NÃO verifica nada aqui, só guarda o estado
   * `token-pendente` e deixa a verificação (`verifyOtp`) para o submit do
   * formulário, em `onSubmit`. Verificar já no carregamento da página teria o
   * mesmo problema do link antigo: qualquer requisição que visite a URL antes
   * da pessoa, antivírus de provedor de e-mail, scanner de link corporativo,
   * preview de webmail, consumiria o token de uso único primeiro, e a pessoa
   * cairia em "link expirado" sem nunca ter tido chance real. Isso já
   * acontecia aqui (era o `#error=otp_expired` tratado abaixo) e é a causa
   * raiz, não só um efeito colateral aceitável.
   *
   * **Antigo, em `#access_token=...`**: o Supabase já verificou o token antes
   * de redirecionar, a troca de `setSession` acontece aqui, no browser, que é
   * o único lugar onde o fragmento existe (nunca chega ao servidor). Mantido
   * para e-mails já enviados antes desta mudança.
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

    if (accessToken && refreshToken) {
      const supabase = createClient()
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(
        ({ error }) => {
          setEstadoDoLink(error ? 'invalido' : 'sessao-pronta')
          // Tira o token da barra de endereços: ele dá acesso à conta e não
          // deveria sobreviver no histórico do navegador nem em um print.
          window.history.replaceState(null, '', window.location.pathname)
        },
      )
      return
    }

    const tokenHash = searchParams.get('token_hash')
    if (tokenHash) {
      setEstadoDoLink('token-pendente')
      return
    }

    // Nem fragmento nem query: ou a pessoa digitou a URL na mão, ou já existe
    // sessão de recuperação estabelecida (por exemplo, ao recarregar a página
    // depois de já ter verificado o token-pendente uma vez).
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setEstadoDoLink(data.session ? 'sessao-pronta' : 'invalido')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // O e-mail da sessão alimenta a validação que recusa "senha igual ao
  // e-mail". A tela não pergunta o endereço, a pessoa já está identificada
  // pelo link, então ele entra no formulário como valor escondido, assim que
  // a sessão de recuperação existe.
  React.useEffect(() => {
    if (estadoDoLink !== 'sessao-pronta') return
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user?.email) setValue('email', data.user.email)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoDoLink])

  const {
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    // `confirmPassword` precisa nascer aqui: o schema exige o campo, e sem ele
    // no defaultValues o resolver falhava com `undefined` num campo que a tela
    // nem renderizava, o erro não tinha onde aparecer e o submit nunca
    // disparava, deixando o botão "Salvar nova senha" inerte.
    defaultValues: { password: '', confirmPassword: '' },
  })

  /**
   * A troca roda AQUI, no navegador, e não numa Server Action.
   *
   * A sessão de recuperação nasce neste componente, no `setSession()` acima,
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

    // Fluxo novo: a sessão de recuperação ainda não existe, o token só é
    // trocado por sessão agora, no submit, nunca no carregamento da página
    // (ver comentário no efeito acima sobre por que isso importa).
    if (estadoDoLink === 'token-pendente') {
      const tokenHash = searchParams.get('token_hash')
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHash ?? '',
      })
      if (verifyError) {
        console.error('verifyOtp (reset de senha) falhou', {
          code: verifyError.code,
          status: verifyError.status,
        })
        setEstadoDoLink('invalido')
        setIsSubmitting(false)
        return
      }
    }

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
      // A senha JÁ mudou, não dá para desfazer, e seguir em silêncio faria a
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
    // ninguém, a senha já está trocada e o acesso, garantido.
    try {
      if (data.user?.email) await limparTentativasDeLogin(data.user.email)
    } catch (err) {
      console.error('limparTentativasDeLogin falhou após reset', err)
    }

    const nome = (data.user?.user_metadata?.name as string | undefined) ?? data.user?.email ?? ''
    setPrimeiroNome(nome.split(' ')[0] ?? '')
    setIsSubmitting(false)
    setEstadoDoLink('sucesso')
  }

  // O redirect pro dashboard some por trás da animação de boas-vindas, mas
  // continua acontecendo sozinho, a pessoa não precisa clicar em nada. Quem
  // pediu `prefers-reduced-motion` não quer esperar a animação, só o
  // suficiente pra tela não parecer ter travado.
  React.useEffect(() => {
    if (estadoDoLink !== 'sucesso') return

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const espera = reduzido ? ESPERA_REDUZIDA_MS : ESPERA_ANTES_DO_DASHBOARD_MS

    const timer = setTimeout(() => {
      // `refresh` antes de navegar: o cookie de sessão acabou de mudar e o
      // dashboard é renderizado no servidor, sem isso ele poderia ser
      // servido com o estado anterior.
      router.refresh()
      router.replace('/dashboard')
    }, espera)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoDoLink])

  if (estadoDoLink === 'verificando') {
    return <AuthCarregando rotulo="Verificando o link…" />
  }

  if (estadoDoLink === 'sucesso') {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="bg-primary/10 text-primary animate-in zoom-in fade-in ease-entrada mb-2 flex size-10 items-center justify-center rounded-lg duration-500">
            <PartyPopper className="size-5" />
          </div>
          <CardTitle className="animate-in fade-in slide-in-from-bottom-2 ease-entrada text-xl duration-[650ms]">
            Bem-vindo de volta{primeiroNome ? `, ${primeiroNome}` : ''}
          </CardTitle>
          <CardDescription className="animate-in fade-in slide-in-from-bottom-3 ease-entrada duration-[750ms]">
            Sua senha foi atualizada. Já estamos te levando pro painel.
          </CardDescription>
        </CardHeader>
        <CardContent className="animate-in fade-in ease-entrada flex flex-col items-center gap-3 duration-[850ms]">
          <Loader2 aria-hidden className="text-muted-foreground size-5 animate-spin" />
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/dashboard" />}
          >
            Ir para o painel agora
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Link já usado ou expirado. Antes isso caía em `/login` com o erro cru na
  // barra de endereços (`error_code=otp_expired`), sem nenhuma explicação e
  // sem saída, a pessoa via só a tela de entrar e não entendia o motivo.
  if (estadoDoLink === 'invalido') {
    return (
      <Card>
        <AuthCabecalho
          variante="cartao"
          tom="erro"
          icone={<MailWarning className="size-5" />}
          titulo="Link expirado"
          descricao="Este link de redefinição já foi usado ou passou da validade. Peça um novo, ele vale por uma hora e só funciona uma vez."
        />
        <CardContent className={`${passo4} flex flex-col gap-3`}>
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
      <AuthCabecalho
        variante="cartao"
        titulo="Redefinir senha"
        descricao="Escolha uma nova senha para sua conta."
      />
      <CardContent className="flex flex-col gap-4">
        {formError && <AuthAlerta>{formError}</AuthAlerta>}

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
