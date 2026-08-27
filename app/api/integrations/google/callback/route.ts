import { NextResponse, type NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { verificarEstado } from '@/lib/integrations/state'
import {
  trocarCodigoPorToken,
  obterEmailDaConta,
  escopoGoogle,
  revogarToken,
} from '@/lib/integrations/google'
import { escopoAtendido, listaDeEscopos } from '@/lib/integrations/escopo-concedido'
import { cifrar } from '@/lib/integrations/crypto'
import { appUrl } from '@/lib/app-url'

// `cifrar`/`createAdminClient` usam `node:crypto`/service role, nunca no
// runtime Edge. Mesmo motivo do webhook do Asaas.
export const runtime = 'nodejs'

/**
 * Volta do consentimento do Google, para Calendar ou Gmail.
 *
 * Usa `createAdminClient()` (service role) para gravar, não o client da
 * sessão: o `state` já provou quem pediu a conexão (assinado no `/connect`,
 * checado com `verificarEstado`, HMAC + validade de 10 minutos), então não
 * precisa da sessão do navegador para autorizar a escrita. É a mesma lógica
 * do webhook do Asaas, que roda sem sessão nenhuma e se autentica por outro
 * segredo, não por cookie.
 */
export async function GET(request: NextRequest) {
  const destino = `${appUrl()}/settings?aba=integracoes`

  const erroDoGoogle = request.nextUrl.searchParams.get('error')
  if (erroDoGoogle) {
    // Consentimento negado ou popup fechado, não é falha do produto.
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

    /**
     * A permissão foi mesmo concedida?
     *
     * A tela de consentimento do Google mostra **uma caixa por permissão**, e
     * ela não vem marcada. Quem clica em "Continuar" sem marcar recebe um
     * `code` válido e um token válido — só que sem `calendar.events.owned` nem
     * `gmail.send`. Nada na resposta do Google avisa.
     *
     * Sem esta checagem, a linha era gravada como `status: 'connected'`, a
     * tela mostrava a faixa verde "conectado com sucesso" e o selo "✓
     * Conectado", e a falha só aparecia dias depois, ao tentar agendar, como
     * um genérico "Não foi possível criar o evento". Duas afirmações falsas na
     * tela e nenhum caminho de volta.
     *
     * Lê do PRÓPRIO token (`token.scope`), não do `tokeninfo`: o dado já está
     * na mão e uma ida de rede a mais no meio do redirect é tempo que a pessoa
     * passa numa tela em branco.
     */
    const exigido = escopoGoogle(estado.provider)
    if (!escopoAtendido(listaDeEscopos(token.scope), exigido)) {
      // Descartar o token sem revogar deixaria uma autorização pendurada na
      // conta Google de quem tentou — concedida por engano, invisível para o
      // produto e que só ela consegue remover, num painel que não conhece.
      await revogarToken(token.access_token).catch((err) => {
        console.error('Callback OAuth Google: falha ao revogar token sem escopo', err)
      })
      return NextResponse.redirect(`${destino}&erro=permissao_faltando`)
    }

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
