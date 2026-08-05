'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend/client'
import { inviteMemberSchema, updateWorkspaceNameSchema } from '@/lib/validations/workspace'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

async function requireAdmin() {
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })

  if (!isAdmin) {
    return { error: 'Apenas administradores podem fazer isso.' as const }
  }

  return { supabase, user, workspaceId }
}

export async function updateWorkspaceName(values: unknown) {
  const parsed = updateWorkspaceNameSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const { error } = await admin.supabase
    .from('workspaces')
    .update({ name: parsed.data.name })
    .eq('id', admin.workspaceId)

  if (error) {
    console.error('updateWorkspaceName falhou', error)
    return { error: 'Não foi possível atualizar o workspace.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function inviteMember(values: unknown) {
  const parsed = inviteMemberSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const { supabase, workspaceId, user } = admin

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, plan')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    return { error: 'Workspace não encontrado.' }
  }

  const { count: memberCount } = await supabase
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  const { count: pendingInvites } = await supabase
    .from('workspace_invites')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')

  // Limite do Free conta membros já ativos + convites pendentes — sem isso,
  // dava pra estourar o limite mandando vários convites de uma vez e todos
  // aceitando depois.
  if (workspace.plan === 'free' && (memberCount ?? 0) + (pendingInvites ?? 0) >= 2) {
    return { error: 'Plano Free permite no máximo 2 membros. Faça upgrade para convidar mais.' }
  }

  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: user.id,
    })
    .select('token')
    .single()

  if (error) {
    console.error('inviteMember falhou', error)
    if (error.code === '23505') {
      return { error: 'Já existe um convite pendente para este e-mail.' }
    }
    return { error: 'Não foi possível criar o convite.' }
  }

  const inviteUrl = `${appUrl()}/convite/${invite.token}`

  const { error: emailError } = await resend.emails.send({
    from: 'Closify CRM <onboarding@resend.dev>',
    to: parsed.data.email,
    subject: `Você foi convidado para o workspace ${workspace.name}`,
    html: `<p>Você foi convidado para colaborar no workspace <strong>${workspace.name}</strong> no Closify CRM.</p><p><a href="${inviteUrl}">Aceitar convite</a></p><p>Este link expira em 7 dias.</p>`,
  })

  if (emailError) {
    console.error('Envio de e-mail de convite falhou', emailError)
    return { error: 'Convite criado, mas não foi possível enviar o e-mail. Tente reenviar.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function revokeInvite(inviteId: string) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const { error } = await admin.supabase
    .from('workspace_invites')
    .delete()
    .eq('id', inviteId)
    .eq('workspace_id', admin.workspaceId)

  if (error) {
    console.error('revokeInvite falhou', error)
    return { error: 'Não foi possível cancelar o convite.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function updateMemberRole(memberUserId: string, role: 'admin' | 'membro') {
  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const { error } = await admin.supabase
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', admin.workspaceId)
    .eq('user_id', memberUserId)

  if (error) {
    console.error('updateMemberRole falhou', error)
    return { error: 'Não foi possível atualizar o papel do membro.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function removeMember(memberUserId: string) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin

  if (memberUserId === admin.user.id) {
    return { error: 'Você não pode remover a si mesmo.' }
  }

  const { error } = await admin.supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', admin.workspaceId)
    .eq('user_id', memberUserId)

  if (error) {
    console.error('removeMember falhou', error)
    return { error: 'Não foi possível remover o membro.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function acceptInvite(token: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'not_authenticated' as const }
  }

  const { error } = await supabase.rpc('accept_workspace_invite', { invite_token: token })

  if (error) {
    console.error('acceptInvite falhou', error)
    return { error: error.message }
  }

  return { success: true }
}
