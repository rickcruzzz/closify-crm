import { describe, expect, it } from 'vitest'

import { deveConfirmarNumero } from '@/lib/whatsapp/adocao'

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
