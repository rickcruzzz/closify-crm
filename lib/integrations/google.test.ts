import { describe, expect, it } from 'vitest'

import { codificarHeaderMime, montarMimeSimples } from './google'

describe('codificarHeaderMime', () => {
  it('deixa ASCII puro intacto', () => {
    expect(codificarHeaderMime('Contato comercial')).toBe('Contato comercial')
  })

  // O bug real: a API do Gmail devolvia "Invalid input" (sem apontar o
  // campo) quando o assunto tinha acento — o header quebrava o parser por
  // não seguir RFC 2047. Este teste documenta o defeito que motivou a função.
  it('codifica em base64 RFC 2047 quando há acento', () => {
    const resultado = codificarHeaderMime('José')
    expect(resultado).toBe(`=?UTF-8?B?${Buffer.from('José', 'utf8').toString('base64')}?=`)
  })

  it('codifica quando há emoji ou outro caractere fora de ASCII', () => {
    const resultado = codificarHeaderMime('Contato 🚀')
    expect(resultado.startsWith('=?UTF-8?B?')).toBe(true)
  })
})

describe('montarMimeSimples', () => {
  function decodificar(base64url: string): string {
    return Buffer.from(base64url, 'base64url').toString('utf8')
  }

  it('inclui os headers obrigatórios e o corpo', () => {
    const raw = decodificar(montarMimeSimples('cliente@example.com', 'Oi', 'Corpo do e-mail'))
    expect(raw).toContain('To: cliente@example.com')
    expect(raw).toContain('Subject: Oi')
    expect(raw).toContain('MIME-Version: 1.0')
    expect(raw).toContain('Content-Transfer-Encoding: 8bit')
    expect(raw).toContain('Corpo do e-mail')
  })

  it('codifica o assunto com acento no header, mas mantém o corpo legível', () => {
    const raw = decodificar(montarMimeSimples('cliente@example.com', 'Reunião amanhã', 'Olá, tudo bem?'))
    expect(raw).toContain('Subject: =?UTF-8?B?')
    // O corpo não passa pela mesma codificação de header — o
    // Content-Transfer-Encoding: 8bit já autoriza UTF-8 cru aqui.
    expect(raw).toContain('Olá, tudo bem?')
  })
})
