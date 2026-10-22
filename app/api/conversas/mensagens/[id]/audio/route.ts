import { NextResponse } from 'next/server'

import { AudioIndisponivelError, responderAudioDaMensagem } from '@/lib/conversas/audio'
import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PRIVADO = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401, headers: PRIVADO })

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
    return NextResponse.json({ erro: 'Áudio não encontrado.' }, { status: 404, headers: PRIVADO })
  }
  // Sessão do usuário e RLS: uma mensagem de outra empresa nunca chega ao proxy.
  const { data: mensagem, error } = await supabase.from('mensagens')
    .select('midia_chave, midia_mime')
    .eq('id', params.id).eq('workspace_id', workspaceId).eq('tipo', 'audio').maybeSingle()
  if (error) return NextResponse.json({ erro: 'Não foi possível abrir o áudio.' }, { status: 503, headers: PRIVADO })
  if (!mensagem) return NextResponse.json({ erro: 'Áudio não encontrado.' }, { status: 404, headers: PRIVADO })
  try {
    return await responderAudioDaMensagem({
      chave: mensagem.midia_chave, mime: mensagem.midia_mime,
      range: request.headers.get('range'), signal: request.signal,
    })
  } catch (erro) {
    const status = erro instanceof AudioIndisponivelError ? erro.status : 502
    return NextResponse.json({ erro: 'Áudio indisponível. O arquivo pode ter expirado no WhatsApp.' }, { status, headers: PRIVADO })
  }
}
