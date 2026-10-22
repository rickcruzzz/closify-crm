import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { obterUsuarioAutenticado } from '@/lib/supabase/usuario-autenticado'
import { resolverWorkspaceAtivoComVinculos, workspaceEscolhidoNoCookie } from '@/lib/workspace/ativo'
import type { WorkspacePlan } from '@/types/supabase'

export type WorkspaceDoUsuario = {
  id: string
  name: string
  plan: WorkspacePlan
  created_by: string | null
  temEnterprise?: boolean
  /**
   * Fim do trial de 7 dias (migration 0051), ou `null` para empresa criada
   * antes dele. Vem nesta consulta em vez de numa própria porque o layout já lê
   * esta linha em toda navegação — buscar de novo custaria uma ida ao banco por
   * página, e a doutrina do projeto sobre isso já foi paga três vezes.
   */
  trial_ate: string | null
}

// Layout e cada page do (dashboard) precisam do usuário logado + workspace_id.
// React cache() memoiza por request: mesma consulta chamada em layout.tsx e
// na page correspondente reaproveita o resultado em vez de bater no Supabase
// duas vezes na mesma navegação.
//
// Também devolve `workspaces`: o `DashboardLayout` precisa da lista com nome e
// plano para o seletor da barra lateral, e antes buscava `workspace_members` +
// `workspaces` de novo, por conta própria, a mesma tabela lida duas vezes na
// mesma navegação. Agora é uma consulta só, aqui.
export const getCurrentUserAndWorkspace = cache(async () => {
  const supabase = await createClient()

  const user = await obterUsuarioAutenticado()

  if (!user) {
    redirect('/login')
  }

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces (id, name, plan, trial_ate, created_by)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .order('workspace_id', { ascending: true })

  const empresas = (memberships ?? [])
    .map((m) => m.workspaces)
    .filter((w): w is WorkspaceDoUsuario => w !== null)
  // O selo vem da vigência real também nas empresas inativas do seletor.
  const workspaces = await Promise.all(empresas.map(async (workspace) => {
    const { data } = await supabase.rpc('enterprise_vigente', { target_workspace_id: workspace.id })
    return { ...workspace, temEnterprise: data === true }
  }))

  // Respeita a empresa escolhida no seletor da barra lateral, caindo na mais
  // antiga quando não há escolha. A lógica vive num lugar só porque a leitura
  // e a ESCRITA precisam concordar: se a página lê de uma empresa e a Server
  // Action grava noutra, o lead some da tela de quem acabou de criá-lo.
  const vinculos = (memberships ?? []).map((m) => ({ workspace_id: m.workspace_id }))
  const escolhido = await workspaceEscolhidoNoCookie()
  const workspaceId = resolverWorkspaceAtivoComVinculos(vinculos, escolhido)

  if (!workspaceId) {
    redirect('/onboarding')
  }

  return { user, workspaceId, workspaces }
})
