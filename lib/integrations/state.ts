import { createHmac, timingSafeEqual } from 'node:crypto'

// Lógica pura (assina/verifica uma string), sem rede, mesmo critério de
// crypto.ts pra não levar `server-only` e continuar testável no Vitest.

export type EstadoOAuth = {
  workspaceId: string
  provider: string
  userId: string
  nonce: string
  criadoEm: number
}

/** 10 minutos: sobra pra completar o consentimento no Google/Meta, sem virar um token reutilizável depois. */
const VALIDADE_MS = 10 * 60 * 1000

function segredo(): string {
  const chave = process.env.INTEGRATIONS_ENCRYPTION_KEY
  if (!chave) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY não configurada.')
  }
  return chave
}

/**
 * Assina o `state` do fluxo OAuth.
 *
 * Sem isso, o callback do Google/Meta é um CSRF clássico: qualquer site
 * conseguiria forçar o navegador de uma vítima a completar uma "conexão" que
 * o atacante controla. A assinatura garante que o `state` que volta no
 * callback é exatamente o que este servidor emitiu, não algo forjado.
 */
export function assinarEstado(dados: Omit<EstadoOAuth, 'criadoEm'>): string {
  const payload: EstadoOAuth = { ...dados, criadoEm: Date.now() }
  const base64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const assinatura = createHmac('sha256', segredo()).update(base64).digest('base64url')
  return `${base64}.${assinatura}`
}

/**
 * Verifica e decodifica o `state` recebido no callback.
 *
 * `timingSafeEqual` na comparação, mesma razão do `isValidToken` do webhook
 * do Asaas: comparação ingênua de string (`===`) vaza quantos bytes batem
 * por diferença de tempo de resposta.
 *
 * Devolve `null` (nunca lança) para qualquer coisa fora do esperado: formato
 * errado, assinatura que não bate, ou state emitido há mais de 10 minutos.
 * Quem chama decide o que fazer com `null`, normalmente, recusar a conexão
 * e pedir para tentar de novo.
 */
export function verificarEstado(token: string): EstadoOAuth | null {
  const [base64, assinatura] = token.split('.')
  if (!base64 || !assinatura) return null

  const esperada = createHmac('sha256', segredo()).update(base64).digest('base64url')
  const recebida = Buffer.from(assinatura)
  const calculada = Buffer.from(esperada)
  if (recebida.length !== calculada.length || !timingSafeEqual(recebida, calculada)) {
    return null
  }

  let payload: EstadoOAuth
  try {
    payload = JSON.parse(Buffer.from(base64, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (typeof payload.criadoEm !== 'number' || Date.now() - payload.criadoEm > VALIDADE_MS) {
    return null
  }

  return payload
}
