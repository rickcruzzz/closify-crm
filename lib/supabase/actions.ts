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
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message === 'User already registered' ? 'Este e-mail já está cadastrado.' : 'Não foi possível criar a conta.' }
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

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ name: parsed.data.workspaceName, created_by: user.id })
    .select('id')
    .single()

  if (workspaceError || !workspace) {
    return { error: 'Não foi possível criar o workspace.' }
  }

  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'admin',
  })

  if (memberError) {
    return { error: 'Não foi possível vincular você ao workspace.' }
  }

  redirect('/dashboard')
}
