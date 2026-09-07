import { describe, expect, it } from 'vitest'

import { extrairDecisor, tokensDaEmpresa } from './decisor'

// Títulos REAIS, colhidos da sonda de 06/09 contra a API do Exa.
const spark = {
  titulo: 'Daniel Pombo - Sócio Proprietário da Spark Comunicação Visual',
  url: 'https://br.linkedin.com/in/daniel-pombo-123',
}
const imagem = {
  titulo: 'sandro schultz - Sócio-Proprietário na Imagem Visual - LinkedIn',
  url: 'https://br.linkedin.com/in/sandro-schultz-456',
}

describe('extrairDecisor', () => {
  it('devolve nome e cargo quando o perfil e comprovadamente da empresa', () => {
    const d = extrairDecisor(spark, 'Spark Comunicação Visual')
    expect(d?.nome).toBe('Daniel Pombo')
    expect(d?.cargo).toMatch(/S[óo]cio Propriet[áa]rio/i)
    expect(d?.perfilUrl).toContain('linkedin.com')
  })

  it('NAO atribui o socio de outra empresa ao prospect', () => {
    // O risco aqui nao e falhar em achar o nome, e achar o nome ERRADO. A
    // ligacao comecaria com um erro de identidade e queimaria a abordagem.
    expect(extrairDecisor(spark, 'Quatrocor Gráfica')).toBeNull()
    expect(extrairDecisor(imagem, 'Spark Comunicação Visual')).toBeNull()
  })

  it('empresa de nome só GENERICO devolve null, e isso e a resposta certa', () => {
    // "Comunicacao Visual Ltda" nao tem token proprio: casar por "comunicacao"
    // atribuiria qualquer socio do setor a ela.
    expect(extrairDecisor(spark, 'Comunicação Visual Ltda')).toBeNull()
    expect(tokensDaEmpresa('Comunicação Visual Ltda')).toEqual([])
  })

  it('corrige a caixa do nome, porque o LinkedIn aceita minuscula', () => {
    // Chamar alguem pelo nome em caixa errada na primeira frase denuncia que o
    // texto foi montado por maquina.
    expect(extrairDecisor(imagem, 'Imagem Visual')?.nome).toBe('Sandro Schultz')
  })

  it('recusa cargo que nao decide compra', () => {
    // Quem assina R$ 49/mes numa PME e dono. Analista e estagiario nao.
    const analista = {
      titulo: 'João Silva - Analista de Marketing na Spark Comunicação Visual',
      url: 'https://br.linkedin.com/in/joao',
    }
    expect(extrairDecisor(analista, 'Spark Comunicação Visual')).toBeNull()
  })

  it('recusa o que nao e perfil do LinkedIn', () => {
    expect(
      extrairDecisor(
        { titulo: 'Daniel Pombo - Sócio Proprietário da Spark', url: 'https://spark.com.br/sobre' },
        'Spark Comunicação Visual',
      ),
    ).toBeNull()
  })

  it('recusa titulo sem separador, porque nao da para dizer onde o nome termina', () => {
    expect(
      extrairDecisor(
        { titulo: 'Sócio Proprietário Spark Comunicação Visual', url: 'https://br.linkedin.com/in/x' },
        'Spark Comunicação Visual',
      ),
    ).toBeNull()
  })

  it('descarta o generico do ramo e mantem o que identifica', () => {
    expect(tokensDaEmpresa('Spark Comunicação Visual')).toEqual(['spark'])
    expect(tokensDaEmpresa('Gráfica Quatrocor')).toEqual(['quatrocor'])
    expect(tokensDaEmpresa('Biodoca Controle de Pragas')).toEqual(['biodoca'])
  })
})

describe('o rendimento medido, e por que a trava fica como esta', () => {
  it('titulo que e SO o nome da pessoa nao casa — e assim deve ser', () => {
    // Medido em 06/09: buscando por "Quatro Pontos Grafica", o Exa devolveu
    // "junior andrades" e "marcio bertholetti" — nomes sem empresa nenhuma.
    // Afrouxar para aceitar isso trocaria zero nome por nomes ERRADOS.
    for (const titulo of ['junior andrades', 'marcio bertholetti', 'qu4tro design']) {
      expect(
        extrairDecisor({ titulo, url: 'https://br.linkedin.com/in/x' }, 'Quatro Pontos Gráfica'),
      ).toBeNull()
    }
  })

  it('pessoa de OUTRA empresa no mesmo setor nao casa', () => {
    // Tambem medido: buscar "Forthlux" devolveu "Kayke Altieri - Executivo
    // Comercial | Especialista em E-commerce", sem relacao com a empresa.
    expect(
      extrairDecisor(
        { titulo: 'Kayke Altieri - Executivo Comercial | Especialista em E-commerce',
          url: 'https://br.linkedin.com/in/kayke' },
        'Forthlux',
      ),
    ).toBeNull()
  })
})
