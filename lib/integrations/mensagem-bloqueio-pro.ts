import type { createClient } from '@/lib/supabase/server'

/**
 * "Seu Pro venceu, reative" só é verdade pra quem JÁ FOI Pro. `subscriptions`
 * é 1 linha por workspace, sem histórico (`unique` em `workspace_id`), então
 * não dá pra checar isso na própria assinatura. `integration_connections`
 * resolve: só ganha linha quando o workspace está ou esteve Pro (a migration
 * 0037 gateia o insert/update por `pro_vigente()`), então existir QUALQUER
 * linha ali, de qualquer provider, é prova de que o Pro já existiu.
 */
export async function mensagemBloqueioPro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<string> {
  const { count } = await supabase
    .from('integration_connections')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  return count && count > 0
    ? 'Seu Pro venceu. Reative o plano para continuar usando integrações.'
    : 'Integrações são um recurso Pro. Faça upgrade para conectar.'
}
