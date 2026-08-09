import { describe, expect, it } from 'vitest'

import { parseCsvLeads, parseValorBRL } from './csv'

/**
 * O parser precisa engolir o que planilha brasileira de verdade exporta, não
 * só o CSV ideal. Cada caso aqui corresponde a um formato que apareceu no
 * desenvolvimento ou a um defeito encontrado testando à mão.
 */

describe('parseValorBRL', () => {
  it('lê o formato brasileiro com milhar e centavos', () => {
    expect(parseValorBRL('R$ 1.234,56')).toBe(1234.56)
    expect(parseValorBRL('1.200,00')).toBe(1200)
  })

  it('lê decimal em inglês', () => {
    expect(parseValorBRL('1234.56')).toBe(1234.56)
  })

  // Defeito corrigido: "R$ 1.200" virava 1.2 porque o ponto era tratado como
  // decimal. O tamanho do último grupo desempata — três dígitos é milhar.
  it('trata ponto isolado com 3 dígitos como separador de milhar', () => {
    expect(parseValorBRL('1.200')).toBe(1200)
    expect(parseValorBRL('12.345.678')).toBe(12345678)
  })

  it('célula vazia vale zero', () => {
    expect(parseValorBRL('')).toBe(0)
    expect(parseValorBRL('   ')).toBe(0)
  })

  // Defeito corrigido: "abc" virava R$ 0,00 em silêncio. Num CRM de vendas,
  // gravar zero errado é pior do que recusar a linha.
  it('recusa texto sem dígito em vez de virar zero', () => {
    expect(parseValorBRL('abc')).toBeNull()
    expect(parseValorBRL('R$')).toBeNull()
  })
})

describe('parseCsvLeads', () => {
  const cabecalho = 'Nome,Telefone,E-mail,Valor'

  it('lê arquivo simples separado por vírgula', () => {
    const { linhas, erros } = parseCsvLeads(
      `${cabecalho}\nMaria Silva,(11) 90000-0000,maria@x.com,"2.500,50"\n`,
    )
    expect(erros).toEqual([])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({
      name: 'Maria Silva',
      email: 'maria@x.com',
      value: 2500.5,
    })
  })

  // Excel em português exporta com ponto e vírgula; sem detectar, o arquivo
  // inteiro vira uma coluna só e nada é importado.
  it('detecta ponto e vírgula do Excel pt-BR', () => {
    const { linhas } = parseCsvLeads('NOME;Celular;E-MAIL;Valor\nAna;11999;ana@x.com;300\n')
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.value).toBe(300)
  })

  it('consome o BOM do Excel sem quebrar o cabeçalho', () => {
    const { linhas, erros } = parseCsvLeads(`﻿${cabecalho}\nJoão,,joao@x.com,10\n`)
    expect(erros).toEqual([])
    expect(linhas[0]?.name).toBe('João')
  })

  it('respeita quebra de linha dentro de aspas', () => {
    const { linhas } = parseCsvLeads(`${cabecalho}\n"Fulano\nde Tal",1,f@x.com,7\n`)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.name).toContain('de Tal')
  })

  it('normaliza e-mail para minúsculo', () => {
    const { linhas } = parseCsvLeads(`${cabecalho}\nAna,,ANA@Empresa.COM,1\n`)
    expect(linhas[0]?.email).toBe('ana@empresa.com')
  })

  it('rejeita a linha e segue quando o dado está sujo', () => {
    const { linhas, erros } = parseCsvLeads(
      `${cabecalho}\n` +
        'A,1,a@x.com,10\n' + // nome curto demais
        'Bruno,,,\n' + // sem e-mail
        'Carlos,,carlos@x.com,abc\n' + // valor inválido
        'Erica,,erica@x.com,-5\n' + // valor negativo
        'Valida,,valida@x.com,100\n',
    )
    // A linha boa entra mesmo com quatro linhas ruins no meio: derrubar o
    // arquivo inteiro por causa de uma linha suja seria pior.
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.email).toBe('valida@x.com')
    expect(erros).toHaveLength(4)
  })

  it('marca e-mail repetido dentro do próprio arquivo', () => {
    const { linhas, erros } = parseCsvLeads(
      `${cabecalho}\nUm,,igual@x.com,1\nDois,,IGUAL@x.com,2\n`,
    )
    expect(linhas).toHaveLength(1)
    expect(erros.some((e) => e.includes('repetido'))).toBe(true)
  })

  it('recusa arquivo sem as colunas obrigatórias', () => {
    const { linhas, erros } = parseCsvLeads('a,b,c\n1,2,3\n')
    expect(linhas).toEqual([])
    expect(erros[0]).toContain('Cabeçalho')
  })

  it('recusa arquivo vazio', () => {
    expect(parseCsvLeads('').erros).toHaveLength(1)
  })
})
