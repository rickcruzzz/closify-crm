import { describe, expect, it } from 'vitest'

import {
  cursorDepoisDaMascara,
  formatarCEP,
  formatarCNPJ,
  formatarTelefone,
} from './mascaras'

describe('formatarCNPJ', () => {
  it('formata enquanto se digita, sem esperar o campo encher', () => {
    expect(formatarCNPJ('1')).toBe('1')
    expect(formatarCNPJ('12')).toBe('12')
    expect(formatarCNPJ('123')).toBe('12.3')
    expect(formatarCNPJ('12345')).toBe('12.345')
    expect(formatarCNPJ('12345678')).toBe('12.345.678')
    expect(formatarCNPJ('123456780001')).toBe('12.345.678/0001')
    expect(formatarCNPJ('12345678000190')).toBe('12.345.678/0001-90')
  })

  // Colar de um e-mail ou de uma planilha traz lixo em volta. Recusar o campo
  // inteiro seria pior do que aproveitar os dígitos.
  it('aproveita os dígitos de um texto colado com lixo', () => {
    expect(formatarCNPJ('CNPJ: 12.345.678/0001-90 (matriz)')).toBe('12.345.678/0001-90')
  })

  it('corta o excesso em vez de recusar', () => {
    expect(formatarCNPJ('123456780001909999')).toBe('12.345.678/0001-90')
  })

  it('campo vazio continua vazio', () => {
    expect(formatarCNPJ('')).toBe('')
    expect(formatarCNPJ('abc')).toBe('')
  })
})

describe('formatarCEP', () => {
  it('põe o hífen depois do quinto dígito', () => {
    expect(formatarCEP('01310')).toBe('01310')
    expect(formatarCEP('013101')).toBe('01310-1')
    expect(formatarCEP('01310100')).toBe('01310-100')
  })

  it('aceita já formatado sem duplicar o hífen', () => {
    expect(formatarCEP('01310-100')).toBe('01310-100')
  })
})

describe('formatarTelefone', () => {
  it('fixo de 10 dígitos corta o hífen depois do quarto', () => {
    expect(formatarTelefone('2133334444')).toBe('(21) 3333-4444')
  })

  // O ponto de corte muda com o nono dígito. Sem isso, um celular apareceria
  // como `(11) 9888-87777` até a última tecla e pareceria errado durante toda
  // a digitação.
  it('celular de 11 dígitos desce o hífen um caractere', () => {
    expect(formatarTelefone('11988887777')).toBe('(11) 98888-7777')
  })

  it('formata desde o primeiro dígito', () => {
    expect(formatarTelefone('1')).toBe('(1')
    expect(formatarTelefone('11')).toBe('(11')
    expect(formatarTelefone('119')).toBe('(11) 9')
    expect(formatarTelefone('119888')).toBe('(11) 9888')
  })

  it('vazio não vira parêntese solto', () => {
    expect(formatarTelefone('')).toBe('')
  })
})

describe('cursorDepoisDaMascara', () => {
  // O defeito que esta função existe para impedir: sem ela o cursor vai para o
  // fim a cada tecla, e corrigir um dígito no meio de um CNPJ é impossível,
  // a cada caractere digitado o cursor foge da mão.
  it('mantém a posição ao corrigir um dígito no meio', () => {
    // Cursor depois de "12.345.6", 6 dígitos à esquerda.
    const posicao = cursorDepoisDaMascara('12.345.6', 8, '12.345.6')
    expect(posicao).toBe(8)
  })

  it('pula a pontuação que a máscara acabou de inserir', () => {
    // Digitou o terceiro dígito: "123" vira "12.3". O cursor estava em 3
    // (três dígitos à esquerda) e precisa ir para 4, depois do "3".
    expect(cursorDepoisDaMascara('123', 3, '12.3')).toBe(4)
  })

  it('cursor no começo continua no começo', () => {
    expect(cursorDepoisDaMascara('12345678000190', 0, '12.345.678/0001-90')).toBe(0)
  })

  it('cursor no fim vai para o fim do texto formatado', () => {
    const formatado = '12.345.678/0001-90'
    expect(cursorDepoisDaMascara('12345678000190', 14, formatado)).toBe(formatado.length)
  })

  // Apagar de trás para frente com backspace: o texto encurta e a posição
  // precisa acompanhar sem saltar.
  it('acompanha o apagar de trás para frente', () => {
    expect(cursorDepoisDaMascara('12.345.67', 9, '12.345.67')).toBe(9)
    expect(cursorDepoisDaMascara('12.345.6', 8, '12.345.6')).toBe(8)
  })
})
