import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'

/**
 * Quem está chamando, de qual empresa, e com qual papel.
 *
 * ## Por que isto saiu de `actions.ts` em vez de ser copiado
 *
 * Porque a segunda cópia é a classe de defeito que a auditoria de 23/09 achou
 * quatro vezes, e o pior caso dela aqui é claro: uma cópia deixa de checar
 * `ehAdmin`, ou passa a ler a empresa de outro lugar, e a divergência não
 * aparece em teste nenhum — as duas continuam devolvendo um objeto com os
 * mesmos campos.
 *
 * ## E por que não exportar de `actions.ts`
 *
 * Aquele arquivo é `'use server'`, e ali **todo export vira endpoint HTTP**.
 * Exportar este helper de lá criaria uma rota que devolve `workspaceId` e papel
 * de quem chamar. `server-only` faz o oposto: o build falha se alguém tentar
 * importar daqui para um componente de cliente.
 *
 * ## Server Action é endpoint HTTP, e é por isso que este bloco existe
 *
 * Dá para chamar sem passar pela tela. Três defeitos deste projeto vieram de
 * regra que só vivia na Server Action, e a última camada nem mora aqui: a
 * trigger `whatsapp_instances_exige_max` (0090) recusa o `insert` mesmo pelo
 * admin client, que ignora RLS e não ignora trigger.
 */
export type Sessao = {
  userId: string
  email: string
  workspaceId: string
  ehAdmin: boolean
}

export async function abrirSessao(): Promise<Sessao | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { error: 'Empresa não encontrada.' }

  const { data: ehAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })

  return { userId: user.id, email: user.email ?? '', workspaceId, ehAdmin: ehAdmin === true }
}
