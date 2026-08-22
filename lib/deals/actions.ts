'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { dealSchema } from '@/lib/validations/deal'
import { uuidSchema } from '@/lib/validations/workspace'
import { dealStages, type DealStage } from '@/lib/deals/types'

async function getActiveWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Mesma resolução que as páginas usam para LER. Precisa ser a mesma: se a
  // tela mostra a empresa escolhida no seletor e a gravação cai na mais
  // antiga, o registro some da vista de quem acabou de criá-lo.
  return resolverWorkspaceAtivo(supabase, user.id)
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
  // workspace_id da linha), sem checar aqui, seria possível vincular um
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
    // String vazia viraria `''` na coluna `date` e o Postgres recusaria.
    // Prazo em branco é ausência de prazo, e `null` é como o banco (e a query
    // de "Próximos prazos", que filtra por `is not null`) já representa isso.
    due_date: parsed.data.dueDate || null,
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
  // Server Actions são endpoints HTTP expostos, o tipo DealStage só é
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
 * Faltava: até aqui um negócio criado por engano só podia mudar de etapa,
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
