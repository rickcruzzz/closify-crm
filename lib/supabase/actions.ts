'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  definirSenhaSchema,
  perfilSchema,
} from '@/lib/validations/auth'
import { appUrl } from '@/lib/app-url'
import { excedeuLimite, limparTentativas } from '@/lib/rate-limit'
import { ipDaRequisicao } from '@/lib/request-ip'
import { guardarIntencao, lerConvitePendente, lerEmailPendente } from '@/lib/auth/intencao'

export async function signIn(values: unknown) {
  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  // Duas camadas, contra duas ameaças diferentes. Por e-mail: força bruta
  // numa conta específica. Por IP, bem mais folgado: password spraying, a
  // mesma senha comum testada contra muitos e-mails, nunca esbarraria no
  // limite de nenhuma conta isolada. Checa os dois ANTES de bater no
  // Supabase, para a tentativa nem chegar ao GoTrue quando já estourou.
  const ip = await ipDaRequisicao()
  const [semLimiteEmail, semLimiteIp] = await Promise.all([
    excedeuLimite('signin', parsed.data.email),
    excedeuLimite('signin-ip', ip),
  ])

  if (semLimiteEmail || semLimiteIp) {
    return {
      error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // Só {code, status}, não o objeto inteiro: alinhado ao padrão do resto
    // deste arquivo, e evita logar mais do erro do GoTrue do que o necessário.
    console.error('signInWithPassword falhou', { code: error.code, status: error.status })
    return { error: 'E-mail ou senha incorretos.' }
  }

  // Acertou a senha: nao deve carregar as tentativas erradas anteriores. Só o
  // contador por e-mail, o de IP não some — o IP não "acertou" nada, ele só
  // hospedou quem acertou, então continua contando para outras tentativas
  // vindas dali.
  await limparTentativas('signin', parsed.data.email)

  redirect('/dashboard')
}

export async function signUp(values: unknown) {
  const parsed = signUpSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  // Guarda ANTES de qualquer chamada de rede, porque todos os caminhos daqui
  // para baixo terminam em `redirect()`, que lança, não haveria depois.
  //
  // O e-mail entra para a tela seguinte poder dizer para onde mandou e
  // oferecer reenvio. Convite e plano entram porque o link do e-mail de
  // confirmação não carrega parâmetro nenhum: sem isto, quem foi convidado
  // termina criando a própria empresa em vez de virar colaborador.
  await guardarIntencao({
    email: parsed.data.email,
    convite: parsed.data.convite ?? null,
    plano: parsed.data.plano ?? null,
  })

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      // `/confirmar`, não `/auth/callback`: o template de e-mail (colado no
      // painel do Supabase) monta o link como `{{ .RedirectTo }}?token_hash=
      // {{ .TokenHash }}&type=signup`, a verificação roda no clique, dentro
      // de `/confirmar`, não automaticamente num GET do Supabase. Isso evita
      // que scanner de link de provedor de e-mail consuma o token de uso
      // único antes da pessoa clicar (era exatamente o defeito de antes:
      // `.ConfirmationURL` verificava no próprio GET, e qualquer prefetch
      // matava o link antes do clique real). `/confirmar` também sabe ler o
      // formato antigo em `#access_token=` para e-mails já enviados.
      emailRedirectTo: `${appUrl()}/confirmar`,
    },
  })

  if (error) {
    console.error('signUp falhou', {
      code: error.code,
      status: error.status,
      message: error.message,
    })

    if (error.code === 'email_exists' || error.code === 'user_already_exists') {
      redirect('/verifique-email')
    }
    if (error.code === 'over_email_send_rate_limit') {
      return {
        error: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.',
      }
    }
    if (error.code === 'weak_password') {
      return { error: 'Senha muito fraca. Use uma senha mais forte.' }
    }
    return { error: 'Não foi possível criar a conta.' }
  }

  // Com "Confirm email" ativo, e-mail já cadastrado e confirmado não retorna
  // erro (proteção anti-enumeration do Supabase), vem como sucesso com
  // identities: [] vazio. Redireciona igual ao caso de sucesso real, sem
  // diferenciar mensagem, pra não vazar quais e-mails já têm conta.
  if (data.user && data.user.identities?.length === 0) {
    redirect('/verifique-email')
  }

  // Com confirmação de e-mail ativa, signUp não retorna sessão, o usuário só
  // ganha sessão real depois de clicar o link, que cai em /auth/callback.
  if (!data.session) {
    redirect('/verifique-email')
  }

  redirect('/onboarding')
}

export async function requestPasswordReset(values: unknown) {
  const parsed = forgotPasswordSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  // Limita por e-mail: o alvo do abuso é a caixa de entrada de quem recebe.
  // Ao estourar, sai pelo MESMO retorno de sucesso do caminho normal, uma
  // mensagem de "muitas tentativas" diria que aquele endereço tem conta, que
  // é exatamente o que o anti-enumeration abaixo evita.
  if (await excedeuLimite('reset-password', parsed.data.email)) {
    return { success: true }
  }

  const supabase = await createClient()
  // Aponta direto para a tela, não para `/auth/callback`.
  //
  // O template de e-mail (colado no painel do Supabase) monta o link como
  // `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`, a
  // verificação (`verifyOtp`) só roda no submit do formulário de nova senha,
  // dentro de `/redefinir-senha`, nunca num GET automático. Sem isso, um
  // scanner de link do provedor de e-mail consumia o token de uso único antes
  // do clique real da pessoa, que caía em "link expirado" sem nunca ter tido
  // chance, era exatamente o defeito de `.ConfirmationURL`, que verifica no
  // próprio GET. `/redefinir-senha` também sabe ler o formato antigo em
  // `#access_token=` para e-mails já enviados.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl()}/redefinir-senha`,
  })

  // Mesma lógica de anti-enumeration do signUp: não revela se o e-mail
  // existe ou não. resetPasswordForEmail do Supabase já não retorna erro
  // pra e-mail inexistente, mas mantemos a checagem por segurança caso
  // o comportamento mude entre versões do SDK.
  if (error) {
    console.error('resetPasswordForEmail falhou', {
      code: error.code,
      status: error.status,
    })
  }

  return { success: true }
}

/**
 * Limpa as tentativas de login erradas depois de uma troca de senha bem
 * sucedida. Quem redefiniu a senha provou posse da conta e não deve carregar o
 * bloqueio das tentativas que antecederam o reset.
 *
 * A troca de senha em si **não** acontece aqui, e isso é deliberado.
 *
 * A sessão de recuperação nasce no navegador: o link do e-mail devolve o token
 * em `#access_token=`, um fragmento de URL, que nunca é enviado ao servidor.
 * A página lê o fragmento e chama `setSession()` no browser. Uma Server Action
 * só enxerga essa sessão depois que o cookie escrito pelo cliente volta numa
 * requisição nova, uma travessia a mais entre "a pessoa clicou em salvar" e
 * "a senha mudou de fato", e a única etapa da cadeia que não dá para observar
 * de fora.
 *
 * O sintoma disso é exatamente o que foi relatado: a pessoa redefine a senha e
 * a antiga continua entrando. Não porque a antiga sobreviveu, o Supabase
 * invalida a senha na hora, verificado contra produção,, mas porque a troca
 * nunca chegou a acontecer. Nos logs de autenticação apareciam vários
 * `POST /recover` e nenhum `PUT /user`.
 *
 * Fazendo o `updateUser` no cliente, ele roda no mesmo lugar onde a sessão de
 * recuperação acabou de ser criada. Não há travessia, e o erro, se houver,
 * chega direto na tela com o código real.
 */
export async function limparTentativasDeLogin(email: string) {
  const parsed = forgotPasswordSchema.safeParse({ email })
  if (!parsed.success) return

  await limparTentativas('signin', parsed.data.email)
}

/**
 * Define uma senha para quem entrou por um provedor externo (Google).
 *
 * Diferente de `updatePassword`, que roda no fluxo de recuperação: aqui a
 * pessoa já está autenticada e está ADICIONANDO um método de acesso, não
 * trocando um existente. Por isso não invalida outras sessões, não há
 * suspeita de conta comprometida neste caminho.
 */
export async function definirSenhaInicial(values: unknown) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sessão expirada. Entre novamente.' }
  }

  // O e-mail vem da SESSÃO, não do payload.
  //
  // A tela manda o endereço junto para o schema conseguir recusar "senha igual
  // ao e-mail" enquanto a pessoa digita. Mas Server Action é endpoint HTTP:
  // quem chama direto simplesmente omite o campo e a validação passa batido.
  // Sobrescrever aqui com o e-mail de quem está logado é o que transforma a
  // dica de tela em regra de verdade.
  const parsed = definirSenhaSchema.safeParse({
    ...(typeof values === 'object' && values !== null ? values : {}),
    email: user.email,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    console.error('definirSenhaInicial falhou', { code: error.code, status: error.status })
    if (error.code === 'weak_password') {
      return { error: 'Senha muito fraca. Use uma senha mais forte.' }
    }
    if (error.code === 'same_password') {
      return { error: 'Escolha uma senha diferente da atual.' }
    }
    return { error: 'Não foi possível definir a senha. Tente novamente.' }
  }

  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Para onde mandar quem acabou de confirmar o e-mail, quando veio de convite.
 *
 * A tela `/confirmar` é Client Component, ela verifica o token no navegador,
 * porque a sessão de recuperação vive lá, e cookie `httpOnly` não é legível
 * por script. Daí esta ponte mínima: devolve o caminho ou `null`, sem expor o
 * token para o JavaScript da página.
 */
export async function destinoDoConvite(): Promise<string | null> {
  const token = await lerConvitePendente()
  return token ? `/convite/${token}` : null
}

/**
 * Reenvia o e-mail de confirmação de cadastro.
 *
 * `/verifique-email` era beco sem saída: não dizia para onde o e-mail tinha
 * ido e não tinha como tentar de novo. E-mail que cai no spam, ou endereço
 * digitado errado, significava cadastro perdido sem recurso, a pessoa teria
 * que criar outra conta, e aí o Supabase devolve "e-mail já existe".
 *
 * O destinatário sai do cookie gravado no `signUp`, nunca de parâmetro do
 * cliente: esta é uma Server Action, e aceitar o endereço de fora
 * transformaria o botão numa máquina de disparar e-mail para qualquer pessoa,
 * queimando a reputação do domínio no Resend.
 */
export async function reenviarConfirmacao() {
  const email = await lerEmailPendente()
  if (!email) {
    return { error: 'Não sabemos para qual e-mail reenviar. Faça o cadastro novamente.' }
  }

  // Mesmo limitador do login e da recuperação de senha, por e-mail e não por
  // IP, o alvo é o endereço, e IP atrás de NAT é compartilhado.
  if (await excedeuLimite('reenviar-confirmacao', email)) {
    return { error: 'Aguarde alguns minutos antes de pedir outro e-mail.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${appUrl()}/confirmar` },
  })

  if (error) {
    console.error('reenviarConfirmacao falhou', { code: error.code, message: error.message })
    // Não distingue "não existe" de "já confirmado": as duas respostas
    // permitiriam descobrir quais e-mails têm conta, mesma razão pela qual o
    // login não diz se a conta existe.
    return { success: true }
  }

  return { success: true }
}

/**
 * Atualiza o nome de exibição do usuário.
 *
 * Grava em `user_metadata.name`, que é de onde a RPC
 * `get_workspace_member_names` lê o nome mostrado na lista de colaboradores e
 * como autor das atividades, mudar aqui reflete em todo lugar que exibe
 * "quem fez o quê", sem tabela de perfil separada.
 */
export async function updateProfile(values: unknown) {
  const parsed = perfilSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sessão expirada. Entre novamente.' }
  }

  const { error } = await supabase.auth.updateUser({
    data: { name: parsed.data.name },
  })

  if (error) {
    console.error('updateProfile falhou', { code: error.code, status: error.status })
    return { error: 'Não foi possível salvar seu nome. Tente novamente.' }
  }

  // A lista de colaboradores e a timeline leem esse nome no servidor.
  revalidatePath('/perfil')
  revalidatePath('/settings')
  revalidatePath('/leads', 'layout')

  return { success: true }
}
