'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { loginSchema, signUpSchema, onboardingSchema } from '@/lib/validations/auth'

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function signIn(values: unknown) {
  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    console.error('signInWithPassword falhou', error)
    return { error: 'E-mail ou senha incorretos.' }
  }

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
    console.error('signUp falhou', { code: error.code, status: error.status, message: error.message })

    if (error.code === 'email_exists' || error.code === 'user_already_exists') {
      return { error: 'Este e-mail já está cadastrado.' }
    }
    if (error.code === 'over_email_send_rate_limit') {
      return { error: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.' }
    }
    if (error.code === 'weak_password') {
      return { error: 'Senha muito fraca. Use uma senha mais forte.' }
    }
    return { error: 'Não foi possível criar a conta.' }
  }

  // Com "Confirm email" ativo, e-mail já cadastrado e confirmado não retorna
  // erro (proteção anti-enumeration do Supabase) — vem como sucesso com
  // identities: [] vazio. Sem checar isso, o usuário caía em /verifique-email
  // achando que a conta foi criada, mas nenhum e-mail novo era enviado.
  if (data.user && data.user.identities?.length === 0) {
    return { error: 'Este e-mail já está cadastrado.' }
  }

  // Com confirmação de e-mail ativa, signUp não retorna sessão — o usuário só
  // ganha sessão real depois de clicar o link, que cai em /auth/callback.
  if (!data.session) {
    redirect('/verifique-email')
  }

  redirect('/onboarding')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${appUrl()}/auth/callback`,
    },
  })

  if (error || !data.url) {
    return { error: 'Não foi possível conectar com o Google.' }
  }

  redirect(data.url)
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
