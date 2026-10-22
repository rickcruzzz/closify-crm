import { describe, expect, it } from 'vitest'

import {
  TIMEOUT_DA_ADOCAO_MS,
  deveConfirmarNumero,
  estourouOTempo,
} from '@/lib/whatsapp/adocao'

/**
 * O defeito de 22/10: "Adotar instância" girando para sempre em produção.
 *
 * A função da Netlify morre em ~10s, e a adoção encadeava duas idas à Z-API de
 * até 8s cada. A Action rejeitava no navegador e o botão nunca parava.
 */
describe('TIMEOUT_DA_ADOCAO_MS', () => {
  /**
   * Status e webhooks são duas etapas em série (os webhooks entre si são
   * paralelos). As duas juntas precisam caber na função com folga para o
   * Supabase, ou o defeito volta com outro número.
   */
  it('duas etapas em serie cabem nos ~10s da Netlify com folga', () => {
    expect(2 * TIMEOUT_DA_ADOCAO_MS).toBeLessThanOrEqual(7_000)
  })
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

describe('deveConfirmarNumero', () => {
  it('conectado sem numero, primeira vez: confirma', () => {
    expect(deveConfirmarNumero({ estado: 'conectado', telefone: null, jaTentou: false })).toBe(
      true,
    )
  })

  /**
   * O laço que esta guarda corta: o servidor devolve um telefone, o refresh não
   * o traz para a prop, e o efeito veria de novo `conectado` + `null`. Sem a
   * memória, seria Server Action e refresh sem fim.
   */
  it('ja tentou neste estado: nao confirma de novo, venha o que vier', () => {
    expect(deveConfirmarNumero({ estado: 'conectado', telefone: null, jaTentou: true })).toBe(
      false,
    )
  })

  it('ja tem numero: nao gasta chamada', () => {
    expect(
      deveConfirmarNumero({ estado: 'conectado', telefone: '5571999999999', jaTentou: false }),
    ).toBe(false)
  })

  it('fora de conectado nao ha numero para pedir', () => {
    for (const estado of ['ausente', 'conectando', 'desconectado', 'erro', 'desconhecido'] as const) {
      expect(deveConfirmarNumero({ estado, telefone: null, jaTentou: false })).toBe(false)
    }
  })
})
