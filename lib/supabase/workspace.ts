import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'

// Layout e cada page do (dashboard) precisam do usuário logado + workspace_id.
// React cache() memoiza por request: mesma consulta chamada em layout.tsx e
// na page correspondente reaproveita o resultado em vez de bater no Supabase
// duas vezes na mesma navegação.
export const getCurrentUserAndWorkspace = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Respeita a empresa escolhida no seletor da barra lateral, caindo na mais
  // antiga quando não há escolha. A lógica vive num lugar só porque a leitura
  // e a ESCRITA precisam concordar: se a página lê de uma empresa e a Server
  // Action grava noutra, o lead some da tela de quem acabou de criá-lo.
  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)

  if (!workspaceId) {
    redirect('/onboarding')
  }

  // Alinha `workspaces.plan` com a validade real da assinatura, e só para
  // baixo. A coluna guarda o último valor gravado pelo webhook e não sabe que
  // o tempo passou: sem esta chamada, um Pro vencido continuaria aparecendo
  // como Pro na tela até o próximo evento do Asaas — que, em quem parou de
  // pagar, não vem nunca.
  //
  // É o único lugar onde isso precisa acontecer: toda página do dashboard passa
  // por aqui, e o `cache()` garante uma chamada por requisição. Os LIMITES não
  // dependem desta sincronização — eles consultam `pro_vigente` direto, no
  // banco, porque coluna desatualizada não pode virar permissão.
  await supabase.rpc('sincronizar_plano_do_workspace', {
    target_workspace_id: workspaceId,
  })

  return { user, workspaceId }
})
