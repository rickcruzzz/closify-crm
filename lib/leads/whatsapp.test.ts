import { describe, expect, it } from 'vitest'

import { linkDoWhatsApp } from './whatsapp'

describe('linkDoWhatsApp', () => {
  // Os formatos que aparecem de verdade na planilha do público-alvo, que é
  // lista de WhatsApp digitada à mão por gente diferente.
  it('aceita celular com máscara, com e sem DDI', () => {
    expect(linkDoWhatsApp('(11) 98888-7777')).toBe('https://wa.me/5511988887777')
    expect(linkDoWhatsApp('11988887777')).toBe('https://wa.me/5511988887777')
    expect(linkDoWhatsApp('+55 11 98888-7777')).toBe('https://wa.me/5511988887777')
    expect(linkDoWhatsApp('55 (11) 98888 7777')).toBe('https://wa.me/5511988887777')
  })

  it('aceita fixo de 8 dígitos', () => {
    expect(linkDoWhatsApp('(21) 3333-4444')).toBe('https://wa.me/552133334444')
  })

  // "0 21 11 98888-7777" é o formato de discagem com operadora. O 0 e o
  // código sobram, mas o 0 na frente é o único que dá para descartar sem
  // adivinhar, então o resto vira tamanho inválido e não vira link errado.
  it('descarta o 0 de operadora à esquerda', () => {
    expect(linkDoWhatsApp('011988887777')).toBe('https://wa.me/5511988887777')
  })

  it('recusa o que não é telefone brasileiro, em vez de chutar', () => {
    expect(linkDoWhatsApp('')).toBeNull()
    expect(linkDoWhatsApp(null)).toBeNull()
    expect(linkDoWhatsApp(undefined)).toBeNull()
    expect(linkDoWhatsApp('sem telefone')).toBeNull()
    expect(linkDoWhatsApp('1234')).toBeNull()
    expect(linkDoWhatsApp('999999999999999999')).toBeNull()
    // DDI de fora do Brasil: 13 dígitos, mas não começa com 55.
    expect(linkDoWhatsApp('+1 415 555 2671')).toBeNull()
  })

  // DDD 00 ou 10 não existe. Sem esta trava, um número torto da planilha
  // viraria um link que abre a tela de erro do WhatsApp e parece defeito
  // nosso.
  it('recusa DDD que não existe', () => {
    expect(linkDoWhatsApp('(00) 98888-7777')).toBeNull()
    expect(linkDoWhatsApp('(10) 98888-7777')).toBeNull()
  })
})
