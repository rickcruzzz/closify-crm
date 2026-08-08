'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import {
  loginSchema,
  signUpSchema,
  onboardingSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validations/auth'
import { appUrl } from '@/lib/app-url'
import { excedeuLimite, limparTentativas } from '@/lib/rate-limit'

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
      emailRedirectTo: `${appUrl()}/auth/callback`,
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

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl()}/auth/callback?next=/redefinir-senha`,
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
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

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

  redirect('/dashboard')
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

  // create_workspace_with_admin roda os dois inserts (workspace + membro
  // admin) numa única transação — sem isso, uma falha no segundo insert
  // deixava um workspace órfão sem membro, e o retry do usuário acumulava
  // workspaces órfãos a cada tentativa.
  const { error: rpcError } = await supabase.rpc('create_workspace_with_admin', {
    workspace_name: parsed.data.workspaceName,
  })

  if (rpcError) {
    console.error('create_workspace_with_admin falhou', rpcError)
    return { error: 'Não foi possível criar o workspace.' }
  }

  redirect('/dashboard')
}
