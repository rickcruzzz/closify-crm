import { createClient } from '@/lib/supabase/server'

export async function getWorkspaceSettingsData(workspaceId: string) {
  const supabase = await createClient()

  const [{ data: workspace }, { data: members }, { data: invites }] = await Promise.all([
    // Uma linha só, sem concatenar: o supabase-js analisa esta string no nível
    // de TIPO para saber o formato do retorno. Quebrada em `'a' + 'b'` ela
    // deixa de ser literal e o resultado inteiro vira `GenericStringError`.
    supabase
      .from('workspaces')
      .select('id, name, plan, trial_ate, segmento, nome_fantasia, cnpj, descricao, logo_url, email_comercial, whatsapp, telefone, site, cep, endereco, numero, complemento, bairro, cidade, estado')
      .eq('id', workspaceId)
      .single(),
    // `.limit()` explícito: sem ele, um workspace com mais de 1.000 membros
    // teria a lista cortada em silêncio pelo PostgREST (mesma classe de
    // defeito já corrigida em getFunnelCounts/getBoardDeals). 1.000 é folga
    // gigante para qualquer PME real; existe só para não herdar o defeito.
    supabase
      .from('workspace_members')
      .select('user_id, role, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(1000),
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
 * Workspaces onde o usuário é o ÚNICO membro, os que somem junto se ele
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

  // Contagem por workspace, uma consulta `count: exact, head: true` cada
  // (agregada no banco, não trazendo linha por linha): trazer as linhas de
  // `workspace_members` com `.select('workspace_id').in(...)` sem `.limit()`
  // corta em 1.000 no PostgREST, e um workspace com muitos membros podia
  // ficar com contagem incompleta e ser confundido com "exclusivo" —
  // consequência real aqui, não só cosmética: `excluir_minha_conta` apaga
  // todo workspace exclusivo junto com a conta.
  const contagens = await Promise.all(
    ids.map((id) =>
      supabase
        .from('workspace_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('workspace_id', id),
    ),
  )

  const contagem = new Map<string, number>()
  ids.forEach((id, i) => contagem.set(id, contagens[i]?.count ?? 0))

  const exclusivos = ids.filter((id) => contagem.get(id) === 1)
  if (exclusivos.length === 0) return []

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('name')
    .in('id', exclusivos)

  return (workspaces ?? []).map((w) => w.name)
}
