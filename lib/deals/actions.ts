'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { dealSchema } from '@/lib/validations/deal'
import { uuidSchema } from '@/lib/validations/workspace'
import { dealStages, type DealStage } from '@/lib/deals/types'

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

export async function createDeal(values: unknown) {
  const parsed = dealSchema.safeParse(values)
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

  // lead_id não é validado pela RLS de deals (a policy só confere
  // workspace_id da linha) — sem checar aqui, seria possível vincular um
  // deal a um lead de outro workspace, só sabendo o UUID.
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('id', parsed.data.leadId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!lead) {
    return { error: 'Lead inválido.' }
  }

  const { error } = await supabase.from('deals').insert({
    workspace_id: workspaceId,
    lead_id: parsed.data.leadId,
    title: parsed.data.title,
    value: parsed.data.value,
    stage: parsed.data.stage,
    owner_id: parsed.data.ownerId,
    due_date: parsed.data.dueDate,
  })

  if (error) {
    console.error('createDeal falhou', error)
    return { error: 'Não foi possível criar o negócio.' }
  }

  revalidatePath('/kanban')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateDealStage(dealId: string, stage: DealStage) {
  // Server Actions são endpoints HTTP expostos — o tipo DealStage só é
  // garantido em tempo de compilação para chamadas feitas pelo próprio
  // client gerado pelo Next. Uma requisição forjada direto ao endpoint
  // pode mandar qualquer string; sem essa checagem, o insert falharia só
  // na constraint do enum do Postgres, mas depois de já ter sido validado
  // contra RLS e workspace, gastando uma query à toa.
  if (!dealStages.includes(stage)) {
    return { error: 'Etapa inválida.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  const { error } = await supabase
    .from('deals')
    .update({ stage })
    .eq('id', dealId)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('updateDealStage falhou', error)
    return { error: 'Não foi possível mover o negócio.' }
  }

  revalidatePath('/kanban')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Exclui um negócio do workspace ativo.
 *
 * Faltava: até aqui um negócio criado por engano só podia mudar de etapa —
 * ficava no funil para sempre, inflando o valor do pipeline no dashboard.
 *
 * `.eq('workspace_id')` junto do `.eq('id')` não é redundância com a RLS: a
 * policy garante que ninguém apague de outra empresa, e esta cláusula garante
 * que a exclusão aconteça no workspace ATIVO da sessão, para quem participa de
 * mais de um.
 */
export async function deleteDeal(dealId: unknown) {
  const parsed = uuidSchema.safeParse(dealId)
  if (!parsed.success) {
    return { error: 'Negócio inválido.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', parsed.data)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('deleteDeal falhou', error)
    return { error: 'Não foi possível excluir o negócio.' }
  }

  revalidatePath('/kanban')
  revalidatePath('/dashboard')
  return { success: true }
}
