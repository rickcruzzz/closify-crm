import type { createClient } from '@/lib/supabase/server'

/**
 * A decisão em si, separada da busca no banco — função pura, testável sem
 * mockar Supabase, mesmo padrão do resto de `lib/**` (schemas, parsers,
 * formatadores).
 *
 * "Seu Pro venceu, reative" só é verdade pra quem JÁ FOI Pro. `subscriptions`
 * é 1 linha por workspace, sem histórico (`unique` em `workspace_id`), então
 * não dá pra checar isso na própria assinatura. `integration_connections`
 * resolve: só ganha linha quando o workspace está ou esteve Pro (a migration
 * 0037 gateia o insert/update por `pro_vigente()`), então existir QUALQUER
 * linha ali, de qualquer provider, é prova de que o Pro já existiu.
 */
export function mensagemPorContagemDeConexoes(count: number | null): string {
  return count && count > 0
    ? 'Seu Pro venceu. Reative o plano para continuar usando integrações.'
    : 'Integrações são um recurso Pro. Faça upgrade para conectar.'
}

export async function mensagemBloqueioPro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<string> {
  const { count } = await supabase
    .from('integration_connections')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  return mensagemPorContagemDeConexoes(count)
}
