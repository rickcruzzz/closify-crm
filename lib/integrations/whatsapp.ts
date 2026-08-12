import { createHmac, timingSafeEqual } from 'node:crypto'

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

export class WhatsAppApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`WhatsApp API ${path} falhou (${status}): ${body}`)
    this.name = 'WhatsAppApiError'
  }
}

function appId(): string {
  const id = process.env.META_APP_ID
  if (!id) throw new Error('META_APP_ID não configurada.')
  return id
}

function appSecret(): string {
  const secret = process.env.META_APP_SECRET
  if (!secret) throw new Error('META_APP_SECRET não configurada.')
  return secret
}

/**
 * Troca o `code` do Embedded Signup por um token de acesso.
 *
 * Mesmo endpoint de troca de código de um OAuth comum da Meta — o Embedded
 * Signup é, por baixo, o Facebook Login configurado para o produto WhatsApp
 * Business. Não usa `redirect_uri` porque o Embedded Signup roda num popup
 * controlado pelo SDK da Meta, não por um redirect de página inteira.
 */
export async function trocarCodigoPorTokenDoSistema(
  code: string,
): Promise<{ access_token: string }> {
  const params = new URLSearchParams({
    client_id: appId(),
    client_secret: appSecret(),
    code,
  })

  const res = await fetch(`${GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`)

  if (!res.ok) {
    throw new WhatsAppApiError(res.status, '/oauth/access_token', await res.text())
  }

  return res.json() as Promise<{ access_token: string }>
}

export async function obterInfoDoNumero(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ display_phone_number: string; verified_name: string }> {
  const res = await fetch(
    `${GRAPH_BASE_URL}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!res.ok) {
    throw new WhatsAppApiError(res.status, `/${phoneNumberId}`, await res.text())
  }

  return res.json() as Promise<{ display_phone_number: string; verified_name: string }>
}

export async function testarNumero(
  phoneNumberId: string,
  accessToken: string,
): Promise<boolean> {
  const res = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}?fields=id`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.ok
}

/**
 * Envia mensagem por MODELO aprovado — nunca texto livre para iniciar
 * conversa. É a regra da própria plataforma: fora da janela de 24h de uma
 * conversa em andamento, só modelo aprovado abre contato. Modelos não são
 * criados pelo produto (decisão do plano de integrações): usa o que já
 * existe aprovado na conta Meta do cliente.
 */
export async function enviarMensagemModelo(
  phoneNumberId: string,
  accessToken: string,
  opcoes: {
    destinatario: string
    nomeDoModelo: string
    idiomaDoModelo: string
    parametros?: string[]
  },
): Promise<{ messages: { id: string }[] }> {
  const res = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: opcoes.destinatario,
      type: 'template',
      template: {
        name: opcoes.nomeDoModelo,
        language: { code: opcoes.idiomaDoModelo },
        ...(opcoes.parametros && opcoes.parametros.length > 0
          ? {
              components: [
                {
                  type: 'body',
                  parameters: opcoes.parametros.map((texto) => ({ type: 'text', text: texto })),
                },
              ],
            }
          : {}),
      },
    }),
  })

  if (!res.ok) {
    throw new WhatsAppApiError(res.status, `/${phoneNumberId}/messages`, await res.text())
  }

  return res.json() as Promise<{ messages: { id: string }[] }>
}

/**
 * Valida a assinatura `X-Hub-Signature-256` do webhook.
 *
 * A Meta assina o CORPO CRU da requisição (antes de qualquer `JSON.parse`)
 * com HMAC-SHA256 usando o App Secret. `timingSafeEqual` pela mesma razão de
 * sempre: comparação ingênua vaza informação por tempo de resposta.
 */
export function validarAssinaturaWebhook(corpoCru: string, assinaturaRecebida: string | null): boolean {
  if (!assinaturaRecebida?.startsWith('sha256=')) return false

  const esperada = createHmac('sha256', appSecret()).update(corpoCru, 'utf8').digest('hex')
  const recebida = Buffer.from(assinaturaRecebida.slice('sha256='.length))
  const calculada = Buffer.from(esperada)

  if (recebida.length !== calculada.length) return false
  return timingSafeEqual(recebida, calculada)
}

export function verificarTokenDoWebhook(tokenRecebido: string | null): boolean {
  const esperado = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (!esperado || !tokenRecebido) return false

  const a = Buffer.from(tokenRecebido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
