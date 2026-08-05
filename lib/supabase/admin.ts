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
