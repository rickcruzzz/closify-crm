import { createCipheriv, randomBytes } from 'node:crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import { cifrar, decifrar } from './crypto'

// Chave de 32 bytes fixa, só para teste, nunca a de produção.
const CHAVE_DE_TESTE = 'a'.repeat(64)

describe('cifrar/decifrar', () => {
  beforeEach(() => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = CHAVE_DE_TESTE
  })

  it('decifra exatamente o que foi cifrado', () => {
    const original = 'ya29.a0AfH6SMB_token_de_exemplo'
    expect(decifrar(cifrar(original))).toBe(original)
  })

  /**
   * O LAYOUT e travado aqui, e nao e zelo: um script `.mjs` escreve nele.
   *
   * `scripts/local/provisionar-evolution.mjs` cifra o token da instancia sem
   * poder importar este modulo — script e `.mjs`, `crypto.ts` e TypeScript, e
   * este projeto nao tem runner de TS instalado. Ele repete a receita do Node,
   * e este caso e o que impede as duas de divergirem.
   *
   * Sem ele, mudar o tamanho do IV aqui deixaria o script gravando um valor que
   * `decifrar` recusa — e o sintoma apareceria como "o WhatsApp desta empresa
   * perdeu a autorizacao", em producao, sem nada apontando para a cifra.
   *
   * A divergencia falha ALTO, no `setAuthTag`, que e o lado bom de errar. O que
   * este caso acrescenta e falhar alto no teste em vez de no cliente.
   */
  it('decifra o que a receita crua do Node produz: IV 12 + tag 16 + cifrado', () => {
    const original = 'hash-de-instancia-da-evolution'

    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(CHAVE_DE_TESTE, 'hex'), iv)
    const cifrado = Buffer.concat([cipher.update(original, 'utf8'), cipher.final()])
    const hex = Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString('hex')
    // Concatenacao e nao template: `\x` dentro de template literal e escape
    // invalido, e o prefixo bytea do Postgres e uma barra seguida de x.
    const bytea = '\\x' + hex

    expect(decifrar(bytea)).toBe(original)
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
    // Troca o último caractere hex, payload continua com formato válido,
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
