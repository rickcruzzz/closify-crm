'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  loginSchema,
  signUpSchema,
  onboardingSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  definirSenhaSchema,
  perfilSchema,
} from '@/lib/validations/auth'
import { appUrl } from '@/lib/app-url'
import { excedeuLimite, limparTentativas } from '@/lib/rate-limit'
import { canAddWorkspace } from '@/lib/limits'
import { FREE_WORKSPACE_LIMIT } from '@/lib/plans'

export async function signIn(values: unknown) {
  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  // Limita por e-mail, nao por IP: o alvo de forca bruta e a conta, e IP
  // atras de NAT e compartilhado por gente que nao tem nada a ver.
  if (await excedeuLimite('signin', parsed.data.email)) {
    return {
      error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    console.error('signInWithPassword falhou', error)
    return { error: 'E-mail ou senha incorretos.' }
  }

  // Acertou a senha: nao deve carregar as tentativas erradas anteriores.
  await limparTentativas('signin', parsed.data.email)

  redirect('/dashboard')
}

export async function signUp(values: unknown) {
  const parsed = signUpSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      // `/confirmar`, não `/auth/callback`: a confirmação de cadastro devolve
      // a sessão em `#access_token=`, e fragmento nunca chega ao servidor. O
      // Route Handler só lê `?code=`, então caía em `/login` mesmo com sessão
      // válida — a pessoa confirmava a conta e precisava digitar a senha de
      // novo. `/confirmar` é client component e lê o fragmento no browser.
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
  // erro (proteção anti-enumeration do Supabase) — vem como sucesso com
  // identities: [] vazio. Redireciona igual ao caso de sucesso real, sem
  // diferenciar mensagem, pra não vazar quais e-mails já têm conta.
  if (data.user && data.user.identities?.length === 0) {
    redirect('/verifique-email')
  }

  // Com confirmação de e-mail ativa, signUp não retorna sessão — o usuário só
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
  // Ao estourar, sai pelo MESMO retorno de sucesso do caminho normal — uma
  // mensagem de "muitas tentativas" diria que aquele endereço tem conta, que
  // é exatamente o que o anti-enumeration abaixo evita.
  if (await excedeuLimite('reset-password', parsed.data.email)) {
    return { success: true }
  }

  const supabase = await createClient()
  // Aponta direto para a tela, não para `/auth/callback`.
  //
  // O link de recuperação devolve a sessão em `#access_token=...`, um FRAGMENTO
  // de URL — e fragmento nunca é enviado ao servidor. O `/auth/callback` é
  // Route Handler: ele só enxerga `?code=`, que neste fluxo não existe. O
  // resultado era cair em `/login` mesmo com link válido.
  //
  // `/redefinir-senha` é client component e lê o fragmento no browser, que é
  // o único lugar onde ele existe.
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

export async function updatePassword(values: unknown) {
  const parsed = resetPasswordSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    console.error('updateUser (reset de senha) falhou', {
      code: error.code,
      status: error.status,
    })
    if (error.code === 'same_password') {
      return { error: 'A nova senha precisa ser diferente da atual.' }
    }
    if (error.code === 'weak_password') {
      return { error: 'Senha muito fraca. Use uma senha mais forte.' }
    }
    return {
      error:
        'Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.',
    }
  }

  // Capturado ANTES do signOut abaixo: depois de mexer na sessão, buscar o
  // usuário de novo seria um round-trip extra e dependeria de um estado que
  // acabou de mudar. O `updateUser` já devolve o usuário atualizado.
  const email = data.user?.email

  // Quem redefine a senha muitas vezes está reagindo a uma conta comprometida.
  // Sem isto, o invasor continua logado nos aparelhos dele: trocar a senha não
  // derruba sessão nenhuma por conta própria.
  //
  // `others` e não `global`: revoga os outros refresh tokens e preserva a
  // sessão atual — confirmado na implementação do auth-js, que só chama
  // `removeCurrentSession()` quando o escopo é diferente de `others`. É o que
  // permite cair no dashboard já autenticado logo abaixo.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })

  // Provou posse da conta: não deve carregar as tentativas de login erradas
  // que antecederam o reset.
  if (email) {
    await limparTentativas('signin', email)
  }

  if (signOutError) {
    console.error('signOut das outras sessões falhou após reset', {
      code: signOutError.code,
      status: signOutError.status,
    })

    // A senha JÁ mudou neste ponto — não dá para desfazer, e mandar para o
    // dashboard em silêncio faria a pessoa acreditar que os outros aparelhos
    // foram desconectados. Quem redefine senha por invasão precisa saber que
    // essa parte não valeu, para encerrar as sessões na mão em Configurações.
    return {
      error:
        'Sua senha foi alterada, mas não conseguimos desconectar os outros dispositivos. Se você suspeita de acesso indevido, troque a senha novamente em alguns instantes.',
    }
  }

  redirect('/dashboard')
}

/**
 * Define uma senha para quem entrou por um provedor externo (Google).
 *
 * Diferente de `updatePassword`, que roda no fluxo de recuperação: aqui a
 * pessoa já está autenticada e está ADICIONANDO um método de acesso, não
 * trocando um existente. Por isso não invalida outras sessões — não há
 * suspeita de conta comprometida neste caminho.
 */
export async function definirSenhaInicial(values: unknown) {
  const parsed = definirSenhaSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sessão expirada. Entre novamente.' }
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

export async function createWorkspace(values: unknown) {
  const parsed = onboardingSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Sem este teto, o limite de 2 colaboradores não segurava nada: bastava
  // criar uma empresa nova para cada dupla e ter equipe ilimitada de graça.
  // A RPC repete a checagem no banco — esta aqui existe para dar mensagem
  // clara antes de chegar lá.
  const limite = await canAddWorkspace(user.id)
  if (!limite.allowed) {
    return { error: limite.reason }
  }

  // create_workspace_with_admin roda os dois inserts (workspace + membro
  // admin) numa única transação — sem isso, uma falha no segundo insert
  // deixava um workspace órfão sem membro, e o retry do usuário acumulava
  // workspaces órfãos a cada tentativa.
  const { error: rpcError } = await supabase.rpc('create_workspace_with_admin', {
    workspace_name: parsed.data.workspaceName,
  })

  if (rpcError) {
    console.error('create_workspace_with_admin falhou', rpcError)
    // A RPC repete a checagem de limite e levanta essa exceção de propósito —
    // é mensagem segura de mostrar, ao contrário do texto cru do Postgres.
    if (rpcError.message.includes('O plano Free inclui')) {
      return {
        error: `O plano Free inclui ${FREE_WORKSPACE_LIMIT} empresa. Faça upgrade para o Pro para gerenciar várias.`,
      }
    }
    return { error: 'Não foi possível criar o workspace.' }
  }

  redirect('/dashboard')
}

/**
 * Atualiza o nome de exibição do usuário.
 *
 * Grava em `user_metadata.name`, que é de onde a RPC
 * `get_workspace_member_names` lê o nome mostrado na lista de colaboradores e
 * como autor das atividades — mudar aqui reflete em todo lugar que exibe
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
