import { beforeEach, describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'

import { validarAssinaturaWebhook, verificarTokenDoWebhook } from './whatsapp'

const APP_SECRET_DE_TESTE = 'segredo-do-app-de-teste'
const VERIFY_TOKEN_DE_TESTE = 'token-de-verificacao-de-teste'

function assinar(corpo: string, segredo = APP_SECRET_DE_TESTE): string {
  return `sha256=${createHmac('sha256', segredo).update(corpo, 'utf8').digest('hex')}`
}

describe('validarAssinaturaWebhook', () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = APP_SECRET_DE_TESTE
  })

  it('aceita assinatura correta do corpo exato', () => {
    const corpo = JSON.stringify({ entry: [{ id: '1' }] })
    expect(validarAssinaturaWebhook(corpo, assinar(corpo))).toBe(true)
  })

  it('recusa corpo alterado depois de assinado (payload não bate com a assinatura)', () => {
    const corpoOriginal = JSON.stringify({ entry: [{ id: '1' }] })
    const assinatura = assinar(corpoOriginal)
    const corpoAdulterado = JSON.stringify({ entry: [{ id: '2' }] })

    expect(validarAssinaturaWebhook(corpoAdulterado, assinatura)).toBe(false)
  })

  it('recusa assinatura calculada com outro App Secret', () => {
    const corpo = JSON.stringify({ entry: [] })
    const assinaturaComOutroSegredo = assinar(corpo, 'segredo-errado')

    expect(validarAssinaturaWebhook(corpo, assinaturaComOutroSegredo)).toBe(false)
  })

  it('recusa header ausente', () => {
    expect(validarAssinaturaWebhook('{}', null)).toBe(false)
  })

  it('recusa header sem o prefixo sha256=', () => {
    const corpo = '{}'
    const semPrefixo = createHmac('sha256', APP_SECRET_DE_TESTE).update(corpo, 'utf8').digest('hex')
    expect(validarAssinaturaWebhook(corpo, semPrefixo)).toBe(false)
  })

  it('recusa assinatura de tamanho errado sem lançar exceção', () => {
    expect(validarAssinaturaWebhook('{}', 'sha256=curto')).toBe(false)
  })
})

describe('verificarTokenDoWebhook', () => {
  beforeEach(() => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN_DE_TESTE
  })

  it('aceita o token configurado', () => {
    expect(verificarTokenDoWebhook(VERIFY_TOKEN_DE_TESTE)).toBe(true)
  })

  it('recusa token diferente', () => {
    expect(verificarTokenDoWebhook('token-errado')).toBe(false)
  })

  it('recusa token nulo', () => {
    expect(verificarTokenDoWebhook(null)).toBe(false)
  })

  it('recusa quando META_WEBHOOK_VERIFY_TOKEN não está configurada', () => {
    delete process.env.META_WEBHOOK_VERIFY_TOKEN
    expect(verificarTokenDoWebhook(VERIFY_TOKEN_DE_TESTE)).toBe(false)
  })
})
