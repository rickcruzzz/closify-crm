import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'

export const runtime = 'nodejs'

const payloadSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  digest: z.string().trim().max(200).optional(),
  stack: z.string().trim().max(8000).optional(),
  url: z.string().trim().max(2000).optional(),
  origem: z.enum(['dashboard', 'global']),
})

/**
 * Recebe o erro que os error boundaries (`app/(dashboard)/error.tsx`,
 * `app/global-error.tsx`) hoje só jogam em `console.error`, morrendo no log
 * da Vercel. Sem autenticação exigida: o erro pode acontecer ANTES de
 * qualquer sessão resolver (ex.: falha no próprio layout raiz). Por isso
 * Route Handler, não Server Action — mesmo critério do projeto para
 * `api/webhooks/*`, reservado ao que não é fluxo normal de tela com sessão
 * garantida.
 *
 * Nunca lança erro para quem chama: uma rota de log que falha não pode virar
 * um novo erro não capturado dentro de um error boundary.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Best-effort: se houver sessão válida, o log ganha workspace/usuário
    // para facilitar investigação. Se não houver (ou a resolução falhar),
    // grava mesmo assim — o registro do erro importa mais que o contexto.
    let workspaceId: string | null = null
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
      }
    } catch {
      // Sessão indisponível ou falhou ao resolver — segue sem contexto.
    }

    const admin = createAdminClient()
    const { error } = await admin.from('error_logs').insert({
      message: parsed.data.message,
      digest: parsed.data.digest ?? null,
      stack: parsed.data.stack ?? null,
      url: parsed.data.url ?? null,
      origem: parsed.data.origem,
      workspace_id: workspaceId,
      user_id: userId,
    })

    if (error) {
      console.error('log-erro: insert falhou', error)
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('log-erro: falha inesperada', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
