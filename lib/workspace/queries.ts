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

/**
 * Workspaces onde o usuário é o ÚNICO membro — os que somem junto se ele
 * excluir a conta.
 *
 * Espelha a regra da RPC `excluir_minha_conta`. Fica aqui em vez de dentro da
 * RPC porque é só leitura, para o diálogo de confirmação avisar o que será
 * perdido antes de a pessoa digitar EXCLUIR.
 */
export async function getWorkspacesExclusivosDoUsuario(userId: string) {
  const supabase = await createClient()

  const { data: vinculos } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)

  const ids = (vinculos ?? []).map((v) => v.workspace_id)
  if (ids.length === 0) return []

  // Conta membros de cada workspace num único round-trip; a RLS já limita as
  // linhas aos workspaces em que este usuário participa.
  const { data: todosOsMembros } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .in('workspace_id', ids)

  const contagem = new Map<string, number>()
  for (const membro of todosOsMembros ?? []) {
    contagem.set(membro.workspace_id, (contagem.get(membro.workspace_id) ?? 0) + 1)
  }

  const exclusivos = ids.filter((id) => contagem.get(id) === 1)
  if (exclusivos.length === 0) return []

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('name')
    .in('id', exclusivos)

  return (workspaces ?? []).map((w) => w.name)
}
