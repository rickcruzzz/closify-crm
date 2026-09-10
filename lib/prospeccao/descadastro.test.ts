import { describe, expect, it } from 'vitest'

import {
  hashDoToken,
  normalizar,
  tokenDeSaida,
  tokenPlausivel,
} from '@/lib/prospeccao/descadastro'

const TEMPERO = 'tempero-de-teste'

describe('token de saída', () => {
  it('é um sha256 em hexadecimal', () => {
    expect(tokenDeSaida('ana@x.com.br', TEMPERO)).toMatch(/^[a-f0-9]{64}$/)
  })

  /** Reenvio para a mesma pessoa precisa carregar o mesmo link. */
  it('é estável para o mesmo endereço', () => {
    expect(tokenDeSaida('ana@x.com.br', TEMPERO)).toBe(tokenDeSaida('ana@x.com.br', TEMPERO))
  })

  it('trata maiúscula e espaço como o mesmo titular', () => {
    expect(tokenDeSaida(' ANA@X.com.br ', TEMPERO)).toBe(tokenDeSaida('ana@x.com.br', TEMPERO))
  })

  it('endereços diferentes dão tokens diferentes', () => {
    expect(tokenDeSaida('ana@x.com.br', TEMPERO)).not.toBe(tokenDeSaida('bia@x.com.br', TEMPERO))
  })

  /**
   * O tempero é o que impede duas coisas: descadastrar terceiro adivinhando o
   * sha256 de um endereço, e — mais grave — reconstruir a lista testando
   * endereços conhecidos contra os hashes guardados.
   */
  it('temperos diferentes dão tokens diferentes', () => {
    expect(tokenDeSaida('ana@x.com.br', 'a')).not.toBe(tokenDeSaida('ana@x.com.br', 'b'))
  })

  /**
   * Sem padrão, de propósito. Valor embutido no código é o mesmo que não ter
   * tempero, porque o código está no Git — então a ausência precisa falhar
   * alto, e não silenciosamente virar `undefined`.
   */
  it('recusa tempero vazio em vez de aceitar em silêncio', () => {
    expect(() => tokenDeSaida('ana@x.com.br', '')).toThrow(/tempero/)
  })
})

describe('o que vai para a tabela', () => {
  /**
   * A linha guarda o hash DO TOKEN, não do e-mail. É o que permite a rota de
   * saída gravar sabendo só o token, sem nunca ver o endereço de quem clicou.
   */
  it('o que é gravado não é o token que veio na URL', () => {
    const t = tokenDeSaida('ana@x.com.br', TEMPERO)
    expect(hashDoToken(t)).not.toBe(t)
    expect(hashDoToken(t)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('o mesmo token dá sempre a mesma linha', () => {
    const t = tokenDeSaida('ana@x.com.br', TEMPERO)
    expect(hashDoToken(t)).toBe(hashDoToken(t))
  })
})

describe('validação do token que chega pela URL', () => {
  it('aceita o formato certo', () => {
    expect(tokenPlausivel(tokenDeSaida('ana@x.com.br', TEMPERO))).toBe(true)
  })

  it('recusa lixo antes de tocar o banco', () => {
    expect(tokenPlausivel('')).toBe(false)
    expect(tokenPlausivel(null)).toBe(false)
    expect(tokenPlausivel(undefined)).toBe(false)
    expect(tokenPlausivel('abc')).toBe(false)
    expect(tokenPlausivel('../../etc/passwd')).toBe(false)
    // sha256 tem 64; 63 e 65 não passam
    expect(tokenPlausivel('a'.repeat(63))).toBe(false)
    expect(tokenPlausivel('a'.repeat(65))).toBe(false)
    // maiúscula não é o formato que geramos
    expect(tokenPlausivel('A'.repeat(64))).toBe(false)
  })
})

describe('normalizar', () => {
  it('minúsculo e sem espaço nas pontas', () => {
    expect(normalizar('  Joao@Empresa.COM.br ')).toBe('joao@empresa.com.br')
  })
})
