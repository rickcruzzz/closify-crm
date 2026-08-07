'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend/client'
import {
  inviteMemberSchema,
  memberRoleSchema,
  updateWorkspaceNameSchema,
  uuidSchema,
} from '@/lib/validations/workspace'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { canAddMember } from '@/lib/limits'
import { appUrl } from '@/lib/app-url'

// O nome do workspace é texto livre e vai interpolado no HTML do e-mail de
// convite, que é entregue a quem ainda nem tem conta. Sem escape, um admin
// consegue injetar link/markup e usar o remetente legítimo pra phishing.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
    .select('name')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    return { error: 'Workspace não encontrado.' }
  }

  const limit = await canAddMember(workspaceId)
  if (!limit.allowed) {
    return { error: limit.reason }
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
    html: `<p>Você foi convidado para colaborar no workspace <strong>${escapeHtml(workspace.name)}</strong> no Closify CRM.</p><p><a href="${inviteUrl}">Aceitar convite</a></p><p>Este link expira em 7 dias.</p>`,
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

export async function updateMemberRole(memberUserId: string, role: unknown) {
  // Server Action é endpoint HTTP: o tipo do parâmetro não protege nada em
  // runtime, um request forjado manda qualquer string.
  const parsed = memberRoleSchema.safeParse(role)
  if (!parsed.success) {
    return { error: 'Papel inválido.' }
  }

  const admin = await requireAdmin()
  if ('error' in admin) return admin

  // Rebaixar o último admin deixa o workspace sem ninguém que possa convidar,
  // cobrar ou gerenciar membros — lockout que só se resolve no banco.
  if (parsed.data === 'membro') {
    const { count } = await admin.supabase
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', admin.workspaceId)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return { error: 'O workspace precisa de pelo menos um administrador.' }
    }
  }

  const { error } = await admin.supabase
    .from('workspace_members')
    .update({ role: parsed.data })
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

// As exceções que a RPC levanta de propósito são seguras de mostrar. Qualquer
// outra coisa (violação de constraint, erro de cast, nome de tabela) vira
// mensagem genérica em vez de vazar o texto cru do Postgres pro browser.
const INVITE_ERRORS = [
  'Convite inválido ou já utilizado.',
  'Convite expirado.',
  'Este convite foi enviado para outro e-mail.',
  'Workspace atingiu o limite de 2 membros do plano Free.',
]

export async function acceptInvite(token: unknown) {
  const parsed = uuidSchema.safeParse(token)
  if (!parsed.success) {
    return { error: 'Convite inválido.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'not_authenticated' as const }
  }

  const { error } = await supabase.rpc('accept_workspace_invite', {
    invite_token: parsed.data,
  })

  if (error) {
    console.error('acceptInvite falhou', error)
    const known = INVITE_ERRORS.find((message) => error.message.includes(message))
    return { error: known ?? 'Não foi possível aceitar o convite.' }
  }

  return { success: true }
}
