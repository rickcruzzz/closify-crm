import { describe, expect, it } from 'vitest'

import { linkDoWhatsApp, normalizarTelefoneBrasileiro } from './whatsapp'

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

describe('o formato que o WhatsApp usa de verdade', () => {
  it('repõe o nono dígito que o WhatsApp remove', () => {
    // Achado em 25/08 com a primeira mensagem real: o `Chat` chega como
    // `557193309404@s.whatsapp.net` — 55 + DDD + OITO dígitos. O WhatsApp
    // remove o nono dígito dos celulares brasileiros.
    //
    // Sem isto, o contato entrava no funil e ficava inalcançável: o botão de
    // WhatsApp sumia da tela dele, e a tarefa "Responder no WhatsApp" não
    // tinha como abrir a conversa. Registrado e sem como falar.
    expect(normalizarTelefoneBrasileiro('557193309404')).toBe('5571993309404')
    expect(linkDoWhatsApp('557193309404')).toBe('https://wa.me/5571993309404')
  })

  it('não confunde com fixo, que tem 8 dígitos começando em 2 a 5', () => {
    // Fixo de verdade continua passando intacto, sem ganhar dígito nenhum.
    expect(normalizarTelefoneBrasileiro('557133309404')).toBe('557133309404')
    expect(normalizarTelefoneBrasileiro('551123456789')).toBe('551123456789')
  })

  it('celular já com o nono continua igual', () => {
    // O mesmo número nas duas formas precisa terminar no MESMO resultado,
    // senão o produto cria dois contatos para a mesma pessoa.
    expect(normalizarTelefoneBrasileiro('5571993309404')).toBe('5571993309404')
    expect(normalizarTelefoneBrasileiro('557193309404')).toBe(
      normalizarTelefoneBrasileiro('5571993309404'),
    )
  })
})
