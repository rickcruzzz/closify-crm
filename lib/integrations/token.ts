import { createAdminClient } from '@/lib/supabase/admin'
import { cifrar, decifrar } from '@/lib/integrations/crypto'
import { renovarAccessToken } from '@/lib/integrations/google'
import type { IntegrationProvider } from '@/types/supabase'

type ResultadoToken = { accessToken: string; externalId: string | null } | { error: string }

/**
 * Devolve um access_token utilizável, renovando primeiro se estiver a menos
 * de 2 minutos de expirar.
 *
 * Um lugar só decide "esse token ainda serve?" — usado tanto por
 * `testarConexaoIntegracao` quanto pelas ações de workflow (agendar no
 * Calendar, enviar e-mail pelo Gmail, enviar modelo no WhatsApp). Duplicar
 * essa lógica em cada chamador é como cada um acaba divergindo um dia sem
 * ninguém notar.
 *
 * Também devolve `external_id` (phone_number_id do WhatsApp) — antes disso,
 * `enviarMensagemWhatsapp` fazia uma SEGUNDA consulta separada só pra pegar
 * essa coluna da mesma linha que esta função já tinha acabado de ler. Toda
 * vez que alguém clicava "Enviar" no modelo, pagava duas idas ao banco pra
 * uma linha só — a lentidão percebida ao interagir com o modal.
 */
export async function obterAccessTokenValido(
  workspaceId: string,
  provider: IntegrationProvider,
): Promise<ResultadoToken> {
  const admin = createAdminClient()
  const { data: linha } = await admin
    .from('integration_connections')
    .select('id, access_token_enc, refresh_token_enc, token_expires_at, external_id')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .maybeSingle()

  if (!linha?.access_token_enc) {
    return { error: 'Integração não conectada.' }
  }

  const expiraEmMs = linha.token_expires_at ? new Date(linha.token_expires_at).getTime() : 0
  const prestesAExpirar = expiraEmMs - Date.now() < 2 * 60 * 1000

  if (!prestesAExpirar || !linha.refresh_token_enc) {
    return { accessToken: decifrar(linha.access_token_enc), externalId: linha.external_id }
  }

  try {
    const renovado = await renovarAccessToken(decifrar(linha.refresh_token_enc))
    await admin
      .from('integration_connections')
      .update({
        access_token_enc: cifrar(renovado.access_token),
        token_expires_at: new Date(Date.now() + renovado.expires_in * 1000).toISOString(),
      })
      .eq('id', linha.id)
    return { accessToken: renovado.access_token, externalId: linha.external_id }
  } catch (err) {
    console.error('Renovação de token falhou', err)
    await admin
      .from('integration_connections')
      .update({ status: 'error', last_error: 'Token expirado. Reconecte a integração.' })
      .eq('id', linha.id)
    return { error: 'Token expirado. Reconecte a integração.' }
  }
}
