/**
 * Assina/verifica o payload que o middleware carimba no header
 * `x-vf-usuario-verificado`, para o Server Component seguinte reaproveitar em
 * vez de chamar `auth.getUser()` de novo.
 *
 * ## Por que isto precisa de assinatura, não só existir
 *
 * `request.headers` é editável pelo middleware, mas um header com este nome
 * também pode chegar direto do cliente na requisição original — Next.js não
 * distingue "header que o middleware escreveu" de "header que o navegador
 * mandou" só pelo nome. Sem assinatura, qualquer requisição a uma rota FORA
 * do matcher do middleware (`middleware.ts`) que ainda chame
 * `obterUsuarioAutenticado` confiaria cegamente num usuário forjado pelo
 * próprio cliente — bypass de autenticação clássico por campo forjável.
 *
 * HMAC com segredo só-servidor fecha isso: só quem tem
 * `INTEGRATIONS_ENCRYPTION_KEY` consegue produzir uma assinatura válida, e o
 * cliente nunca tem essa chave. Mesmo critério de `lib/integrations/state.ts`
 * (assinatura do `state` do OAuth) e do `CRON_SECRET` dos webhooks — reusa a
 * mesma chave que `state.ts` já usa para HMAC, de propósito: não precisa de
 * uma variável de ambiente nova só para isto. `SUPABASE_SERVICE_ROLE_KEY`
 * fica de fora por escopo: aquela chave bypassa RLS por completo, e usá-la
 * para HMAC seria dar a ela um segundo uso sem necessidade.
 *
 * ## Por que Web Crypto, não `node:crypto`
 *
 * `state.ts` usa `node:crypto`, mas só roda em Route Handler (runtime Node).
 * Este módulo é importado pelo `middleware.ts`, que roda em **edge runtime**
 * — `node:crypto` não existe lá, só a Web Crypto API (`crypto.subtle`), que
 * também está disponível no runtime Node. Por isso este arquivo usa
 * `crypto.subtle` em vez do módulo `node:crypto`, para funcionar nos dois.
 */

const VALIDADE_MS = 60 * 1000 // 1 minuto: cobre a mesma requisição, não um replay depois

function segredo(): string {
  const chave = process.env.INTEGRATIONS_ENCRYPTION_KEY
  if (!chave) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY não configurada.')
  }
  return chave
}

async function chaveHmac(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function paraBase64Url(bytes: ArrayBuffer): string {
  const array = new Uint8Array(bytes)
  let binario = ''
  for (let i = 0; i < array.length; i++) binario += String.fromCharCode(array[i])
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64Url(valor: string): ArrayBuffer {
  const normalizado = valor.replace(/-/g, '+').replace(/_/g, '/')
  const preenchido = normalizado.padEnd(normalizado.length + ((4 - (normalizado.length % 4)) % 4), '=')
  const binario = atob(preenchido)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes.buffer
}

export async function assinarUsuarioVerificado(usuarioJson: string): Promise<string> {
  const payload = JSON.stringify({ usuario: usuarioJson, criadoEm: Date.now() })
  const base64 = paraBase64Url(new TextEncoder().encode(payload).buffer as ArrayBuffer)
  const chave = await chaveHmac()
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(base64))
  return `${base64}.${paraBase64Url(assinatura)}`
}

/** Devolve o JSON do usuário se a assinatura bater e não tiver expirado; `null` em qualquer outro caso. */
export async function verificarUsuarioVerificado(token: string): Promise<string | null> {
  const [base64, assinatura] = token.split('.')
  if (!base64 || !assinatura) return null

  const chave = await chaveHmac()
  const valida = await crypto.subtle.verify(
    'HMAC',
    chave,
    deBase64Url(assinatura),
    new TextEncoder().encode(base64),
  )
  if (!valida) return null

  let payload: { usuario: string; criadoEm: number }
  try {
    payload = JSON.parse(new TextDecoder().decode(deBase64Url(base64)))
  } catch {
    return null
  }

  if (typeof payload.criadoEm !== 'number' || Date.now() - payload.criadoEm > VALIDADE_MS) {
    return null
  }

  return payload.usuario
}
