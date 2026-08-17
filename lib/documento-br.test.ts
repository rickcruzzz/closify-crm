import { describe, expect, it } from 'vitest'

import { formatarCpfCnpj, validarCnpj, validarCpf, validarCpfCnpj } from './documento-br'

describe('validarCpf', () => {
  it('aceita CPF com dígito verificador correto', () => {
    // CPFs válidos publicamente usados em documentação e testes.
    expect(validarCpf('529.982.247-25')).toBe(true)
    expect(validarCpf('11144477735')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(validarCpf('529.982.247-24')).toBe(false)
    expect(validarCpf('11144477736')).toBe(false)
  })

  it('recusa sequência de dígitos iguais', () => {
    // Passa na conta do dígito verificador, mas não é CPF de ninguém, a
    // Receita e o Asaas recusam.
    expect(validarCpf('111.111.111-11')).toBe(false)
    expect(validarCpf('00000000000')).toBe(false)
  })

  it('recusa tamanho errado', () => {
    expect(validarCpf('1234567890')).toBe(false)
    expect(validarCpf('')).toBe(false)
  })
})

describe('validarCnpj', () => {
  it('aceita CNPJ com dígito verificador correto', () => {
    // CNPJ real do Banco do Brasil, público.
    expect(validarCnpj('00.000.000/0001-91')).toBe(true)
    // O CNPJ do próprio controlador, já conferido nas páginas legais.
    expect(validarCnpj('64.543.748/0001-13')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(validarCnpj('00.000.000/0001-92')).toBe(false)
    expect(validarCnpj('64.543.748/0001-14')).toBe(false)
  })

  it('recusa sequência de dígitos iguais e tamanho errado', () => {
    expect(validarCnpj('11.111.111/1111-11')).toBe(false)
    expect(validarCnpj('123')).toBe(false)
  })
})

describe('validarCpfCnpj', () => {
  it('decide pelo tamanho', () => {
    expect(validarCpfCnpj('529.982.247-25')).toBe(true)
    expect(validarCpfCnpj('64.543.748/0001-13')).toBe(true)
  })

  it('recusa tamanho intermediário', () => {
    // 12 ou 13 dígitos não é CPF nem CNPJ.
    expect(validarCpfCnpj('123456789012')).toBe(false)
    expect(validarCpfCnpj('1234567890123')).toBe(false)
  })
})

describe('formatarCpfCnpj', () => {
  it('formata CPF durante a digitação', () => {
    expect(formatarCpfCnpj('529')).toBe('529')
    expect(formatarCpfCnpj('529982')).toBe('529.982')
    expect(formatarCpfCnpj('52998224')).toBe('529.982.24')
    expect(formatarCpfCnpj('52998224725')).toBe('529.982.247-25')
  })

  it('vira formato de CNPJ ao passar de 11 dígitos', () => {
    expect(formatarCpfCnpj('64543748000113')).toBe('64.543.748/0001-13')
  })

  it('descarta dígito além do 14º', () => {
    expect(formatarCpfCnpj('645437480001139999')).toBe('64.543.748/0001-13')
  })

  it('aceita valor já formatado sem duplicar pontuação', () => {
    // O onChange recebe o valor anterior a cada tecla; reformatar texto já
    // formatado é o caminho normal.
    expect(formatarCpfCnpj('529.982.247-25')).toBe('529.982.247-25')
    expect(formatarCpfCnpj('64.543.748/0001-13')).toBe('64.543.748/0001-13')
  })

  it('devolve vazio sem dígito', () => {
    expect(formatarCpfCnpj('')).toBe('')
    expect(formatarCpfCnpj('abc')).toBe('')
  })
})
