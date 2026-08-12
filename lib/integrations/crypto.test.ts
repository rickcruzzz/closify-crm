import { beforeEach, describe, expect, it } from 'vitest'

import { cifrar, decifrar } from './crypto'

// Chave de 32 bytes fixa, só para teste — nunca a de produção.
const CHAVE_DE_TESTE = 'a'.repeat(64)

describe('cifrar/decifrar', () => {
  beforeEach(() => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = CHAVE_DE_TESTE
  })

  it('decifra exatamente o que foi cifrado', () => {
    const original = 'ya29.a0AfH6SMB_token_de_exemplo'
    expect(decifrar(cifrar(original))).toBe(original)
  })

  it('produz um valor no formato bytea do Postgres (\\x + hex)', () => {
    expect(cifrar('qualquer coisa')).toMatch(/^\\x[0-9a-f]+$/)
  })

  it('dois textos iguais cifram para valores diferentes (IV aleatório)', () => {
    const a = cifrar('mesmo texto')
    const b = cifrar('mesmo texto')
    expect(a).not.toBe(b)
  })

  it('recusa decifrar payload cifrado com outra chave', () => {
    const cifrado = cifrar('segredo')
    process.env.INTEGRATIONS_ENCRYPTION_KEY = 'b'.repeat(64)
    expect(() => decifrar(cifrado)).toThrow()
  })

  it('recusa decifrar payload adulterado', () => {
    const cifrado = cifrar('segredo')
    // Troca o último caractere hex — payload continua com formato válido,
    // mas o conteúdo (e portanto a tag de autenticação) não bate mais.
    const adulterado = cifrado.slice(0, -1) + (cifrado.endsWith('0') ? '1' : '0')
    expect(() => decifrar(adulterado)).toThrow()
  })

  it('recusa cifrar sem INTEGRATIONS_ENCRYPTION_KEY configurada', () => {
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY
    expect(() => cifrar('qualquer coisa')).toThrow()
  })

  it('recusa chave com tamanho errado', () => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = 'ab'
    expect(() => cifrar('qualquer coisa')).toThrow()
  })
})
