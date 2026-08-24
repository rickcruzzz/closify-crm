import 'server-only'

import { decifrar } from '@/lib/integrations/crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Lê o token cifrado da conexão já existente, decifrado. `null` se não existe.
 *
 * Vive num arquivo próprio, fora de `actions.ts` (`'use server'`) e fora de
 * `api.ts` (que não toca banco), porque a partir de 24/08 dois módulos
 * diferentes precisam dela: as Server Actions do diálogo de conexão E o
 * webhook (`app/api/webhooks/evolution/[workspaceId]/[segredo]/route.ts`),
 * que passou a tentar reconectar sozinho quando a sessão cai — e um handler
 * de rota não pode importar de um arquivo `'use server'`, cujos exports
 * precisam ser Server Actions.
 */
export async function obterTokenDaInstancia(workspaceId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('integration_connections')
    .select('access_token_enc')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'whatsapp')
    .maybeSingle()

  if (!data?.access_token_enc) return null
  return decifrar(data.access_token_enc as unknown as string)
}
