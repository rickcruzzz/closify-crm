import { appUrl } from '@/lib/app-url'
import type { IntegrationProvider } from '@/types/supabase'

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`Google API ${path} falhou (${status}): ${body}`)
    this.name = 'GoogleApiError'
  }
}

// Um escopo por conexão, nunca os dois juntos, quem conecta só Calendar não
// autoriza envio de e-mail, e vice-versa. Menor privilégio: a pessoa concede
// exatamente o que a tela pediu, visível na própria tela de consentimento do
// Google.
const ESCOPO_POR_PROVIDER: Record<'google_calendar' | 'gmail', string> = {
  google_calendar: 'https://www.googleapis.com/auth/calendar.events',
  gmail: 'https://www.googleapis.com/auth/gmail.send',
}

export function escopoGoogle(provider: 'google_calendar' | 'gmail'): string {
  return ESCOPO_POR_PROVIDER[provider]
}

function clientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!id) throw new Error('GOOGLE_OAUTH_CLIENT_ID não configurada.')
  return id
}

function clientSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!secret) throw new Error('GOOGLE_OAUTH_CLIENT_SECRET não configurada.')
  return secret
}

// Mesmo redirect URI para as duas integrações, o `provider` viaja dentro do
// `state` assinado (lib/integrations/state.ts), não na URL. Um único redirect
// URI cadastrado no Google Cloud Console é mais simples de manter do que um
// por escopo.
function redirectUri(): string {
  return `${appUrl()}/api/integrations/google/callback`
}

export function montarUrlDeAutorizacao(
  provider: 'google_calendar' | 'gmail',
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: `openid email ${escopoGoogle(provider)}`,
    access_type: 'offline',
    // `prompt=consent` força o Google a emitir refresh_token de novo mesmo
    // que a pessoa já tenha autorizado este app antes, sem isso, reconectar
    // depois de desconectar devolveria só um access_token de curta duração,
    // sem jeito de renovar sozinho.
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export async function trocarCodigoPorToken(code: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    throw new GoogleApiError(res.status, '/token', await res.text())
  }

  return res.json() as Promise<TokenResponse>
}

export async function renovarAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    throw new GoogleApiError(res.status, '/token (refresh)', await res.text())
  }

  // A renovação não devolve `refresh_token` de novo, o original continua
  // válido. Quem chama deve preservar o refresh_token já gravado.
  return res.json() as Promise<TokenResponse>
}

/**
 * Revoga o token no Google, na desconexão.
 *
 * Engole erro de propósito: quem chama sempre apaga a linha local depois,
 * mesmo que a revogação remota falhe (token já expirado, rede fora), não
 * pode deixar uma integração "meio desconectada" por causa de um problema do
 * lado do Google.
 */
export async function revogarToken(token: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    })
  } catch (err) {
    console.error('revogarToken (Google) falhou', err)
  }
}

export async function obterEmailDaConta(accessToken: string): Promise<string | null> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const dados = (await res.json()) as { email?: string }
  return dados.email ?? null
}

export type EventoDeCalendario = {
  titulo: string
  descricao?: string
  inicioIso: string
  fimIso: string
  timezone: string
}

export async function criarEventoDeCalendario(
  accessToken: string,
  evento: EventoDeCalendario,
): Promise<{ id: string; htmlLink: string }> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: evento.titulo,
        description: evento.descricao,
        start: { dateTime: evento.inicioIso, timeZone: evento.timezone },
        end: { dateTime: evento.fimIso, timeZone: evento.timezone },
      }),
    },
  )

  if (!res.ok) {
    throw new GoogleApiError(res.status, '/calendar/v3/.../events', await res.text())
  }

  return res.json() as Promise<{ id: string; htmlLink: string }>
}

export async function testarCalendario(accessToken: string): Promise<boolean> {
  // `calendars.get` (o endpoint usado antes aqui) exige calendar.readonly/
  // calendar/calendar.calendars, a lista oficial de escopos aceitos por
  // esse método não inclui `calendar.events`, que é o único que a conexão
  // pede (menor privilégio). Mesma causa raiz do bug já corrigido em
  // `testarGmail`: testar com endpoint que a conexão não tem permissão de
  // chamar sempre devolve 403 e marca conexão saudável como quebrada.
  return testarEscopoConcedido(accessToken, escopoGoogle('google_calendar'))
}

// Monta o e-mail no formato RFC 2822 exigido pelo `raw` da API do Gmail,
// texto simples, sem anexo, sem HTML: o produto não vira um cliente de
// e-mail completo (fora de escopo, decisão do plano).
/**
 * RFC 2047: um header de e-mail (aqui, `Subject`) só aceita ASCII puro. Um
 * assunto com acento passado cru ("Contato José") quebra o parser do Gmail —
 * medido em produção, a API devolve "Invalid input" sem apontar qual campo.
 * `=?UTF-8?B?<base64>?=` é a forma "encoded-word" que o padrão exige para
 * qualquer caractere fora de ASCII no header.
 */
export function codificarHeaderMime(valor: string): string {
  // eslint-disable-next-line no-control-regex -- checagem de ASCII puro é o próprio propósito
  if (/^[\x00-\x7F]*$/.test(valor)) return valor
  return `=?UTF-8?B?${Buffer.from(valor, 'utf8').toString('base64')}?=`
}

export function montarMimeSimples(destinatario: string, assunto: string, corpo: string): string {
  const linhas = [
    `To: ${destinatario}`,
    `Subject: ${codificarHeaderMime(assunto)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    // O CORPO (diferente do header acima) aceita UTF-8 cru, mas só se o
    // transporte for declarado — sem isto, o Gmail já rejeitou mensagem com
    // acento no corpo com o mesmo "Invalid input" genérico.
    'Content-Transfer-Encoding: 8bit',
    '',
    corpo,
  ]
  return Buffer.from(linhas.join('\r\n'), 'utf8').toString('base64url')
}

export async function enviarEmailGmail(
  accessToken: string,
  opcoes: { destinatario: string; assunto: string; corpo: string },
): Promise<{ id: string }> {
  const raw = montarMimeSimples(opcoes.destinatario, opcoes.assunto, opcoes.corpo)

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    throw new GoogleApiError(res.status, '/gmail/v1/users/me/messages/send', await res.text())
  }

  return res.json() as Promise<{ id: string }>
}

// Testar CADA integração batendo na API real dela (Gmail, Calendar) exigia
// endpoint próprio, e tanto `GET /gmail/v1/users/me/profile` quanto
// `GET /calendar/v3/calendars/primary` pedem escopo de LEITURA que a conexão
// nunca tem (ela só pede o escopo mínimo de escrita, `gmail.send` ou
// `calendar.events`, ver `ESCOPO_POR_PROVIDER`). Testar com endpoint que a
// própria integração não tem permissão de chamar sempre devolve 403 e marca
// conexão saudável como quebrada, dois bugs iguais, achados em sequência.
//
// `tokeninfo` valida o token sem exigir escopo nenhum de API específica,
// serve pros dois provedores. Confirmar que `scope` inclui o escopo exigido
// garante que não é só um token válido de OUTRA finalidade.
async function testarEscopoConcedido(accessToken: string, escopoExigido: string): Promise<boolean> {
  // Header, não query string, token de acesso não deve viajar em URL (fica
  // em log de acesso). Confirmado contra o endpoint real que ele aceita
  // Authorization: Bearer (erro muda de "token ausente" pra "token
  // inválido" quando testado com um token qualquer via header).
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return false
  const info = (await res.json()) as { scope?: string }
  // Comparação exata contra a lista de escopos, não substring, evita casar
  // por acidente com um escopo diferente que só contenha o mesmo texto.
  return (info.scope ?? '').split(/\s+/).includes(escopoExigido)
}

export async function testarGmail(accessToken: string): Promise<boolean> {
  return testarEscopoConcedido(accessToken, escopoGoogle('gmail'))
}

/** Providers Google válidos, subconjunto de IntegrationProvider (exclui 'whatsapp'). */
export function ehProviderGoogle(
  provider: IntegrationProvider,
): provider is 'google_calendar' | 'gmail' {
  return provider === 'google_calendar' || provider === 'gmail'
}
