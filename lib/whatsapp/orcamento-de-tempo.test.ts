import { describe, expect, it } from 'vitest'

import {
  TIMEOUT_NA_ACTION_MS,
  TIMEOUT_PARA_CRIAR_MS,
  estourouOTempo,
} from '@/lib/whatsapp/orcamento-de-tempo'

/**
 * O defeito de 22/10: "Adotar instância" girando para sempre em produção.
 *
 * A função da Netlify morre em ~10s, e as Actions do WhatsApp encadeavam idas
 * à Z-API de até 8s cada. A Action rejeitava no navegador e o botão nunca
 * parava. Cada caso abaixo é uma Action real, com as etapas EM SÉRIE que ela
 * faz no pior caminho; paralelas contam uma vez.
 */
const SUPABASE_MS = 2_000
const TETO_MS = 9_000

describe('o pior caso de cada Action cabe na Netlify', () => {
  const casos: Array<[string, number]> = [
    // status, depois os quatro PUT de webhook em paralelo
    ['adotarInstancia', 2 * TIMEOUT_NA_ACTION_MS],
    // status, depois assinar e device em paralelo
    ['lerQrCode (conectou)', 2 * TIMEOUT_NA_ACTION_MS],
    // criar, depois o primeiro QR
    ['conectarWhatsapp (Partner)', TIMEOUT_PARA_CRIAR_MS + TIMEOUT_NA_ACTION_MS],
    // criar, o insert falha, cancelar. DELETE e o POST do 405 dividem UM teto:
    // somados, eles estourariam (3,5 + 2,5 + 2,5 + 2 = 10,5s)
    ['conectarWhatsapp (insert falhou)', TIMEOUT_PARA_CRIAR_MS + TIMEOUT_NA_ACTION_MS],
    // webhooks em paralelo, depois o primeiro QR
    ['conectarWhatsapp (reserva)', 2 * TIMEOUT_NA_ACTION_MS],
    // DELETE e POST no 405, no mesmo teto
    ['removerWhatsapp (Partner)', TIMEOUT_NA_ACTION_MS],
    ['desconectarWhatsapp', TIMEOUT_NA_ACTION_MS],
    ['confirmarNumeroConectado', TIMEOUT_NA_ACTION_MS],
  ]

  for (const [nome, zapiMs] of casos) {
    it(`${nome}: Z-API + Supabase abaixo de ${TETO_MS}ms`, () => {
      expect(zapiMs + SUPABASE_MS).toBeLessThan(TETO_MS)
    })
  }
})

describe('estourouOTempo', () => {
  /**
   * O `AbortController` de `chamar` faz o `fetch` lançar `AbortError`. Antes,
   * esse erro virava "a Z-API não reconheceu este ID e token" e mandava quem
   * colou as credenciais certas conferir o painel por nada.
   */
  it('AbortError e tempo', () => {
    const erro = new Error('This operation was aborted')
    erro.name = 'AbortError'
    expect(estourouOTempo(erro)).toBe(true)
  })

  it('TimeoutError (AbortSignal.timeout) tambem e tempo', () => {
    const erro = new Error('timeout')
    erro.name = 'TimeoutError'
    expect(estourouOTempo(erro)).toBe(true)
  })

  it('recusa do provedor NAO e tempo', () => {
    const erro = new Error('Z-API respondeu 403 em /status')
    erro.name = 'ZapiError'
    expect(estourouOTempo(erro)).toBe(false)
  })

  it('valor que nao e objeto nao quebra', () => {
    expect(estourouOTempo(null)).toBe(false)
    expect(estourouOTempo('AbortError')).toBe(false)
    expect(estourouOTempo(undefined)).toBe(false)
  })
})
