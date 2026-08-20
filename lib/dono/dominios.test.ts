import { describe, expect, it } from 'vitest'

import { dominioProvavelmenteErrado } from './dominios'

describe('dominioProvavelmenteErrado', () => {
  // O caso real que motivou a função: dona da "Agência Nova Era", em produção,
  // com um e-mail que nunca vai receber nada.
  it('pega o caso real de produção', () => {
    expect(dominioProvavelmenteErrado('testei122@gmaa2il.com')).toBe('gmail.com')
  })

  it('pega os erros de digitação mais comuns', () => {
    expect(dominioProvavelmenteErrado('a@gmial.com')).toBe('gmail.com')
    expect(dominioProvavelmenteErrado('a@gmail.co')).toBe('gmail.com')
    expect(dominioProvavelmenteErrado('a@hotmial.com')).toBe('hotmail.com')
    expect(dominioProvavelmenteErrado('a@outlok.com')).toBe('outlook.com')
  })

  it('não acusa domínio comum escrito certo', () => {
    for (const email of [
      'a@gmail.com',
      'a@hotmail.com',
      'a@outlook.com',
      'a@icloud.com',
      'a@uol.com.br',
    ]) {
      expect(dominioProvavelmenteErrado(email)).toBeNull()
    }
  })

  // O risco real da função é o alarme falso: sugerir a alguém que o e-mail do
  // cliente está errado quando não está. Domínio de empresa é legítimo e não
  // pode ser confundido com erro de digitação.
  it('não acusa domínio próprio de empresa', () => {
    for (const email of [
      'contato@velofunil.com.br',
      'joao@minhaempresa.com.br',
      'a@closify.dev',
      'a@agencia.com',
    ]) {
      expect(dominioProvavelmenteErrado(email)).toBeNull()
    }
  })

  it('aguenta entrada torta sem quebrar', () => {
    expect(dominioProvavelmenteErrado(null)).toBeNull()
    expect(dominioProvavelmenteErrado(undefined)).toBeNull()
    expect(dominioProvavelmenteErrado('')).toBeNull()
    expect(dominioProvavelmenteErrado('sem-arroba')).toBeNull()
    expect(dominioProvavelmenteErrado('a@')).toBeNull()
  })

  it('não diferencia maiúscula de minúscula', () => {
    expect(dominioProvavelmenteErrado('A@GMAIL.COM')).toBeNull()
    expect(dominioProvavelmenteErrado('A@GMIAL.COM')).toBe('gmail.com')
  })
})
