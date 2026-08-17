import { describe, expect, it } from 'vitest'

import { decodificarPlanilha, detectarSeparador, lerCsv, parseValorBRL } from './csv'

/** Windows-1252 e Unicode coincidem byte a byte para o texto destes testes. */
function bytesWindows1252(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.codePointAt(i)!
  return bytes
}

describe('decodificarPlanilha', () => {
  // Defeito confirmado em 11/08/2026: o diálogo usava `File.text()`, que
  // decodifica SEMPRE em UTF-8, e o Excel em português salva CSV em
  // Windows-1252. "José Antônio" chegava ao banco como "Jos<?> Ant<?>nio".
  it('lê arquivo do Excel pt-BR sem quebrar o acento', () => {
    const texto = decodificarPlanilha(bytesWindows1252('Nome;Cidade\nJosé Antônio;Salvador\n'))
    expect(texto).toContain('José Antônio')
    expect(texto).not.toContain('�')
  })

  it('não estraga arquivo que já é UTF-8', () => {
    const bytes = new TextEncoder().encode('Nome,Cidade\nJosé Antônio,Salvador\n')
    expect(decodificarPlanilha(bytes)).toContain('José Antônio')
  })

  // O BOM do Excel ("CSV UTF-8") vira caractere invisível grudado no primeiro
  // cabeçalho e faz "Nome" deixar de casar com "nome".
  it('remove o BOM do Excel', () => {
    const corpo = new TextEncoder().encode('Nome,Cidade\nAna,Salvador\n')
    const comBom = new Uint8Array(corpo.length + 3)
    comBom.set([0xef, 0xbb, 0xbf], 0)
    comBom.set(corpo, 3)
    expect(decodificarPlanilha(comBom).startsWith('Nome')).toBe(true)
  })
})

describe('detectarSeparador', () => {
  it('reconhece o ponto e vírgula do Excel pt-BR', () => {
    expect(detectarSeparador('Nome;Telefone;E-mail;Valor')).toBe(';')
  })

  it('reconhece a vírgula do Google Sheets', () => {
    expect(detectarSeparador('Nome,Telefone,E-mail,Valor')).toBe(',')
  })

  // Sem ignorar o conteúdo entre aspas, "2.500,00" faria a vírgula ganhar de
  // um arquivo que na verdade é separado por ponto e vírgula.
  it('ignora separador que está dentro de aspas', () => {
    expect(detectarSeparador('Nome;Valor;"a,b,c,d,e"')).toBe(';')
  })
})

describe('lerCsv', () => {
  it('devolve cabeçalho e linhas como matriz', () => {
    const matriz = lerCsv('Nome;E-mail\nAna;ana@x.com\nBruno;bruno@x.com\n')
    expect(matriz).toEqual([
      ['Nome', 'E-mail'],
      ['Ana', 'ana@x.com'],
      ['Bruno', 'bruno@x.com'],
    ])
  })

  // `split('\n')` quebraria aqui: endereço colado da planilha traz quebra de
  // linha dentro de campo entre aspas.
  it('mantém quebra de linha dentro de campo entre aspas', () => {
    const matriz = lerCsv('Nome,Obs\nAna,"linha 1\nlinha 2"\n')
    expect(matriz).toHaveLength(2)
    expect(matriz[1]?.[1]).toBe('linha 1\nlinha 2')
  })

  it('trata aspas duplicadas como aspa literal', () => {
    expect(lerCsv('A\n"diz ""oi"""\n')[1]?.[0]).toBe('diz "oi"')
  })

  it('descarta linha totalmente vazia', () => {
    expect(lerCsv('Nome\nAna\n\n\nBruno\n')).toHaveLength(3)
  })

  it('devolve matriz vazia para arquivo em branco', () => {
    expect(lerCsv('   \n  ')).toEqual([])
  })
})

describe('parseValorBRL', () => {
  it('lê o formato brasileiro com milhar e centavos', () => {
    expect(parseValorBRL('R$ 1.234,56')).toBe(1234.56)
    expect(parseValorBRL('1.200,00')).toBe(1200)
  })

  it('lê o formato em inglês', () => {
    expect(parseValorBRL('1234.56')).toBe(1234.56)
  })

  // "1.200" numa planilha brasileira é mil e duzentos; o tamanho do último
  // grupo desempata contra "1234.56", que é decimal exportado em inglês.
  it('desempata ponto de milhar e ponto decimal pelo tamanho do grupo', () => {
    expect(parseValorBRL('1.200')).toBe(1200)
    expect(parseValorBRL('1.20')).toBe(1.2)
  })

  it('célula em branco é zero, porque lead sem valor estimado é normal', () => {
    expect(parseValorBRL('')).toBe(0)
    expect(parseValorBRL('   ')).toBe(0)
  })

  // Defeito corrigido: "abc" virava R$ 0,00 em silêncio, o que é pior do que
  // recusar a linha, num CRM de vendas o valor errado contamina o dashboard.
  it('recusa texto sem dígito em vez de virar zero', () => {
    expect(parseValorBRL('abc')).toBeNull()
    expect(parseValorBRL('a combinar')).toBeNull()
  })
})
