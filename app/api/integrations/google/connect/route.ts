import { randomUUID } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  resolverWorkspaceAtivoComVinculos,
  workspaceEscolhidoNoCookie,
} from '@/lib/workspace/ativo'
import { assinarEstado } from '@/lib/integrations/state'
import { montarUrlDeAutorizacao } from '@/lib/integrations/google'
import { appUrl } from '@/lib/app-url'

/**
 * Início do fluxo OAuth do Google, para Calendar ou Gmail.
 *
 * Não é Server Action de propósito: `signInWithOAuth`/redirect externo
 * precisa de um GET de verdade que o navegador possa seguir, o mesmo motivo
 * que já fez `lib/supabase/google-auth.ts` disparar do lado do cliente para
 * o login. Aqui o servidor decide tudo antes do redirect (workspace, admin,
 * escopo), então não precisa rodar no browser.
 */
export async function GET(request: NextRequest) {
  const destinoDeErro = `${appUrl()}/settings?aba=integracoes&erro=`

  const provider = request.nextUrl.searchParams.get('provider')
  if (provider !== 'google_calendar' && provider !== 'gmail') {
    return NextResponse.redirect(`${destinoDeErro}provider_invalido`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${appUrl()}/login`)
  }

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .order('workspace_id', { ascending: true })

  const vinculos = (memberships ?? []).map((m) => ({ workspace_id: m.workspace_id }))
  const escolhido = await workspaceEscolhidoNoCookie()
  const workspaceId = resolverWorkspaceAtivoComVinculos(vinculos, escolhido)

  if (!workspaceId) {
    return NextResponse.redirect(`${appUrl()}/onboarding`)
  }

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })

  if (!isAdmin) {
    return NextResponse.redirect(`${destinoDeErro}somente_admin`)
  }

  // O callback grava com service role (o `state` assinado já prova quem
  // pediu), então RLS não protege este fluxo, a checagem de plano tem que
  // estar aqui, antes de assinar o `state`. Só quem passa por este GET
  // consegue um `state` válido; barrar aqui fecha o caminho por inteiro.
  const { data: podeConectar } = await supabase.rpc('pro_vigente', {
    target_workspace_id: workspaceId,
  })

  if (!podeConectar) {
    return NextResponse.redirect(`${destinoDeErro}plano_free`)
  }

  const state = assinarEstado({ workspaceId, provider, userId: user.id, nonce: randomUUID() })
  return NextResponse.redirect(montarUrlDeAutorizacao(provider, state))
}
