import { describe, expect, it } from 'vitest'

import { normalizarTelefone } from './meta-conversions'

describe('normalizarTelefone', () => {
  // A Meta documenta que aceita variação de formatação no envio, mas duas
  // grafias do mesmo número precisam virar o MESMO hash para casar com o que
  // o Pixel do navegador (ou outro evento) já mandou — daí remover toda
  // pontuação antes de hashear.
  it('remove parênteses, espaço e traço', () => {
    expect(normalizarTelefone('(11) 99999-9999')).toBe('11999999999')
  })

  it('mantém string já só com dígitos intacta', () => {
    expect(normalizarTelefone('11999999999')).toBe('11999999999')
  })

  it('remove o + do DDI', () => {
    expect(normalizarTelefone('+55 11 99999-9999')).toBe('5511999999999')
  })
})
