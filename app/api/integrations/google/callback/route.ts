import { NextResponse, type NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { verificarEstado } from '@/lib/integrations/state'
import { trocarCodigoPorToken, obterEmailDaConta } from '@/lib/integrations/google'
import { cifrar } from '@/lib/integrations/crypto'
import { appUrl } from '@/lib/app-url'

// `cifrar`/`createAdminClient` usam `node:crypto`/service role — nunca no
// runtime Edge. Mesmo motivo do webhook do Asaas.
export const runtime = 'nodejs'

/**
 * Volta do consentimento do Google, para Calendar ou Gmail.
 *
 * Usa `createAdminClient()` (service role) para gravar, não o client da
 * sessão: o `state` já provou quem pediu a conexão (assinado no `/connect`,
 * checado com `verificarEstado` — HMAC + validade de 10 minutos), então não
 * precisa da sessão do navegador para autorizar a escrita. É a mesma lógica
 * do webhook do Asaas — que roda sem sessão nenhuma e se autentica por outro
 * segredo, não por cookie.
 */
export async function GET(request: NextRequest) {
  const destino = `${appUrl()}/settings?aba=integracoes`

  const erroDoGoogle = request.nextUrl.searchParams.get('error')
  if (erroDoGoogle) {
    // Consentimento negado ou popup fechado — não é falha do produto.
    return NextResponse.redirect(`${destino}&erro=cancelado`)
  }

  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(`${destino}&erro=parametros_ausentes`)
  }

  const estado = verificarEstado(stateParam)
  if (!estado || (estado.provider !== 'google_calendar' && estado.provider !== 'gmail')) {
    return NextResponse.redirect(`${destino}&erro=state_invalido`)
  }

  try {
    const token = await trocarCodigoPorToken(code)
    const email = await obterEmailDaConta(token.access_token)

    const admin = createAdminClient()
    const expiraEm = new Date(Date.now() + token.expires_in * 1000).toISOString()

    const { error } = await admin.from('integration_connections').upsert(
      {
        workspace_id: estado.workspaceId,
        provider: estado.provider,
        status: 'connected',
        account_label: email,
        scopes: token.scope.split(' '),
        access_token_enc: cifrar(token.access_token),
        // Sem `refresh_token` novo (raro, com `prompt=consent` sempre vem):
        // não sobrescreve o que já existia gravado de uma conexão anterior.
        ...(token.refresh_token ? { refresh_token_enc: cifrar(token.refresh_token) } : {}),
        token_expires_at: expiraEm,
        last_error: null,
        connected_by: estado.userId,
      },
      { onConflict: 'workspace_id,provider' },
    )

    if (error) {
      console.error('Callback OAuth Google: falha ao gravar conexão', error)
      return NextResponse.redirect(`${destino}&erro=falha_ao_conectar`)
    }

    return NextResponse.redirect(`${destino}&conectado=${estado.provider}`)
  } catch (err) {
    console.error('Callback OAuth Google falhou', err)
    return NextResponse.redirect(`${destino}&erro=falha_ao_conectar`)
  }
}
