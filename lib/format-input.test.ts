import { describe, expect, it } from 'vitest'

import {
  formatarMoedaBRL,
  formatarTelefoneBR,
  moedaParaNumero,
  numeroParaMoeda,
} from './format-input'

describe('formatarMoedaBRL', () => {
  it('trata os dois últimos dígitos como centavos, feito teclado de caixa', () => {
    expect(formatarMoedaBRL('1')).toBe('0,01')
    expect(formatarMoedaBRL('150')).toBe('1,50')
    expect(formatarMoedaBRL('1500')).toBe('15,00')
    expect(formatarMoedaBRL('150000')).toBe('1.500,00')
  })

  it('ignora o que não é dígito, para o campo aguentar colagem', () => {
    expect(formatarMoedaBRL('R$ 1.500,00')).toBe('1.500,00')
  })

  it('devolve vazio quando não há dígito', () => {
    expect(formatarMoedaBRL('')).toBe('')
    expect(formatarMoedaBRL('abc')).toBe('')
  })
})

describe('ida e volta do valor', () => {
  // O campo mostra texto formatado e o banco guarda número. Se a conversão
  // perder precisão em algum dos sentidos, o valor do negócio muda sozinho
  // toda vez que alguém abrir o formulário para editar.
  it('preserva o valor entre banco, campo e banco', () => {
    for (const valor of [0, 49, 1110, 1234.56, 2500.5, 99999.99]) {
      expect(moedaParaNumero(numeroParaMoeda(valor))).toBe(valor)
    }
  })

  it('zero vira campo vazio, não "0,00"', () => {
    // Campo em branco convida a preencher; "0,00" parece valor já definido.
    expect(numeroParaMoeda(0)).toBe('')
  })
})

describe('formatarTelefoneBR', () => {
  it('formata celular com nono dígito', () => {
    expect(formatarTelefoneBR('71993309404')).toBe('(71) 99330-9404')
  })

  it('formata fixo de oito dígitos', () => {
    expect(formatarTelefoneBR('7133090404')).toBe('(71) 3309-0404')
  })

  it('vai formatando durante a digitação', () => {
    expect(formatarTelefoneBR('7')).toBe('(7')
    expect(formatarTelefoneBR('71')).toBe('(71')
    expect(formatarTelefoneBR('719')).toBe('(71) 9')
    expect(formatarTelefoneBR('719933')).toBe('(71) 9933')
  })

  it('descarta dígito além do 11º', () => {
    expect(formatarTelefoneBR('7199330940412345')).toBe('(71) 99330-9404')
  })

  it('aceita número já formatado sem duplicar pontuação', () => {
    // Reformatar texto já formatado é o caminho normal: o onChange recebe o
    // valor anterior a cada tecla.
    expect(formatarTelefoneBR('(71) 99330-9404')).toBe('(71) 99330-9404')
  })

  it('devolve vazio quando não há dígito', () => {
    expect(formatarTelefoneBR('')).toBe('')
    expect(formatarTelefoneBR('abc')).toBe('')
  })
})
