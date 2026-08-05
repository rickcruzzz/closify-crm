import { createClient } from '@/lib/supabase/server'

export async function getWorkspaceSettingsData(workspaceId: string) {
  const supabase = await createClient()

  const [{ data: workspace }, { data: members }, { data: invites }] = await Promise.all([
    supabase.from('workspaces').select('id, name, plan').eq('id', workspaceId).single(),
    supabase
      .from('workspace_members')
      .select('user_id, role, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true }),
    supabase
      .from('workspace_invites')
      .select('id, email, role, status, created_at, expires_at')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  const userIds = (members ?? []).map((m) => m.user_id)
  const { data: names } = userIds.length
    ? await supabase.rpc('get_workspace_member_names', {
        target_workspace_id: workspaceId,
        target_user_ids: userIds,
      })
    : { data: [] as { user_id: string; name: string }[] }

  const nameByUserId = new Map((names ?? []).map((n) => [n.user_id, n.name]))

  return {
    workspace,
    members: (members ?? []).map((m) => ({ ...m, name: nameByUserId.get(m.user_id) ?? m.user_id })),
    invites: invites ?? [],
  }
}
