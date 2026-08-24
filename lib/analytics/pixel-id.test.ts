import { describe, expect, it } from 'vitest'

import { pixelIdSeguro } from './pixel-id'

/**
 * Cada caso aqui documenta o incidente de 24/08/2026: o ID do pixel colado na
 * Vercel com uma quebra de linha no fim virava `fbq('init', '123\n')`, string
 * literal partida em duas linhas, `SyntaxError` durante o commit do React e
 * TELA PRETA para quem tivesse aceitado os cookies.
 */
describe('pixelIdSeguro', () => {
  it('aceita o ID real, intacto', () => {
    expect(pixelIdSeguro('1566349361566072')).toBe('1566349361566072')
  })

  it('remove a quebra de linha que derrubou a produção', () => {
    // O valor exato que estava na Vercel. Sem o `trim`, este `\n` fecha a
    // string no meio e o script inteiro deixa de ser JavaScript válido.
    expect(pixelIdSeguro('1566349361566072\n')).toBe('1566349361566072')
  })

  it('remove espaço em volta, que o copiar-e-colar arrasta junto', () => {
    expect(pixelIdSeguro('  1566349361566072  ')).toBe('1566349361566072')
    expect(pixelIdSeguro('\r\n1566349361566072\r\n')).toBe('1566349361566072')
  })

  it('remove aspas coladas junto do valor', () => {
    // Acontece quando alguém copia `"123"` de um arquivo .env ou de um JSON.
    expect(pixelIdSeguro('"1566349361566072"')).toBe('1566349361566072')
    expect(pixelIdSeguro("'1566349361566072'")).toBe('1566349361566072')
  })

  it('remove espaço de largura zero, invisível em qualquer inspeção', () => {
    // Entra em cópia de painel web e não aparece nem olhando o campo. Era o
    // único jeito de esse defeito voltar depois de corrigido "a olho".
    expect(pixelIdSeguro('1566349361566072​')).toBe('1566349361566072')
    expect(pixelIdSeguro('﻿1566349361566072')).toBe('1566349361566072')
  })

  it('recusa qualquer coisa que não seja só dígitos', () => {
    // A defesa que importa: o valor entra num script INLINE. Um valor com
    // caractere estranho não é configuração errada, é injeção de código.
    expect(pixelIdSeguro("123'); alert(1); ('")).toBeNull()
    expect(pixelIdSeguro('abc123')).toBeNull()
    expect(pixelIdSeguro('123-456')).toBeNull()
  })

  it('devolve null para vazio ou ausente', () => {
    expect(pixelIdSeguro(undefined)).toBeNull()
    expect(pixelIdSeguro('')).toBeNull()
    expect(pixelIdSeguro('   ')).toBeNull()
  })
})
