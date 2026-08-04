'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { leadSchema } from '@/lib/validations/lead'

async function getActiveWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

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
