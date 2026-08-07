// Faz o build falhar se algum client component importar este módulo, direta
// ou indiretamente. Antes a regra era só convenção — e um import errado
// mandaria a service role key (que ignora RLS) pro bundle do browser.
import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

// Client com service role — ignora RLS. Só para contextos sem sessão de
// usuário (webhooks de integrações externas), nunca em Server Actions ou
// Server Components que atendem requisição de usuário logado.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
