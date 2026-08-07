'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { leadSchema } from '@/lib/validations/lead'
import { activitySchema } from '@/lib/validations/activity'
import { canAddLead } from '@/lib/limits'

async function getActiveWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Sem order by, o Postgres pode escolher um workspace diferente entre
  // requests para quem participa de mais de um — gravaria no workspace errado.
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .order('workspace_id', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.workspace_id ?? null
}

// owner_id não é validado pela RLS de leads (a policy só confere workspace_id
// da linha) — sem checar aqui, qualquer membro autenticado poderia atribuir
// um lead a um user_id de fora do workspace, só adivinhando/vazando o UUID.
async function isWorkspaceMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!data
}

export async function createLead(values: unknown) {
  const parsed = leadSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  if (!(await isWorkspaceMember(supabase, workspaceId, parsed.data.ownerId))) {
    return { error: 'Responsável inválido.' }
  }

  const limit = await canAddLead(workspaceId)
  if (!limit.allowed) {
    return { error: limit.reason }
  }

  const { error } = await supabase.from('leads').insert({
    workspace_id: workspaceId,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    company: parsed.data.company,
    status: parsed.data.status,
    owner_id: parsed.data.ownerId,
    value: parsed.data.value,
  })

  if (error) {
    console.error('createLead falhou', error)
    return { error: 'Não foi possível criar o lead.' }
  }

  revalidatePath('/leads')
  return { success: true }
}

export async function updateLead(leadId: string, values: unknown) {
  const parsed = leadSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  if (!(await isWorkspaceMember(supabase, workspaceId, parsed.data.ownerId))) {
    return { error: 'Responsável inválido.' }
  }

  const { error } = await supabase
    .from('leads')
    .update({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      status: parsed.data.status,
      owner_id: parsed.data.ownerId,
      value: parsed.data.value,
    })
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('updateLead falhou', error)
    return { error: 'Não foi possível atualizar o lead.' }
  }

  revalidatePath('/leads')
  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export async function createActivity(leadId: string, values: unknown) {
  const parsed = activitySchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sessão expirada.' }
  }

  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  // Confere que o lead pertence ao workspace ativo antes de gravar —
  // a RLS de activities.insert também confere isso, mas falhar aqui com
  // mensagem clara é melhor do que deixar a RLS rejeitar silenciosamente.
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!lead) {
    return { error: 'Lead não encontrado.' }
  }

  const { error } = await supabase.from('activities').insert({
    workspace_id: workspaceId,
    lead_id: leadId,
    author_id: user.id,
    type: parsed.data.type,
    description: parsed.data.description,
  })

  if (error) {
    console.error('createActivity falhou', error)
    return { error: 'Não foi possível registrar a atividade.' }
  }

  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export async function deleteLead(leadId: string) {
  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('deleteLead falhou', error)
    return { error: 'Não foi possível excluir o lead.' }
  }

  revalidatePath('/leads')
  return { success: true }
}
