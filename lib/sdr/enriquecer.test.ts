import { describe, expect, it } from 'vitest'

import {
  consultaSobreAEmpresa,
  contextoParaOPrompt,
  devePesquisar,
  limparAchados,
} from '@/lib/sdr/enriquecer'

describe('a consulta', () => {
  /**
   * Buscar o NOME devolve homônimo, diretório de CNPJ e perfil de rede social
   * — foi o que sujou a colheita de 07/09, onde `br.pinterest.com` e quatro
   * sindicatos entraram na lista. O domínio ancora na empresa certa.
   */
  it('ancora no domínio, não no nome', () => {
    expect(consultaSobreAEmpresa('solaron.eco.br')).toContain('solaron.eco.br')
  })

  it('aceita URL completa e reduz ao host', () => {
    expect(consultaSobreAEmpresa('https://solaron.eco.br/quem-somos')).toContain('solaron.eco.br')
    expect(consultaSobreAEmpresa('https://solaron.eco.br/quem-somos')).not.toContain('quem-somos')
  })

  it('recusa domínio vazio em vez de buscar o nada', () => {
    expect(() => consultaSobreAEmpresa('   ')).toThrow(/vazio/)
  })
})

describe('limpar os achados', () => {
  const bom = {
    url: 'https://solaron.eco.br/',
    title: 'SolarOn',
    text: 'A SolarOn faz projeto e instalação de energia solar para residências e empresas em São Paulo, com equipe própria de engenharia.',
  }

  it('mantém o que descreve a empresa', () => {
    expect(limparAchados([bom])).toHaveLength(1)
  })

  /** Diretório e rede social não são a empresa — a mesma regra da colheita. */
  it('descarta diretório e rede social', () => {
    const ruins = [
      { ...bom, url: 'https://br.pinterest.com/x' },
      { ...bom, url: 'https://www.econodata.com.br/y' },
      { ...bom, url: 'https://cnpj.biz/z' },
      { ...bom, url: 'https://www.linkedin.com/company/w' },
    ]
    expect(limparAchados(ruins)).toHaveLength(0)
  })

  it('fica com um por host', () => {
    expect(
      limparAchados([bom, { ...bom, url: 'https://solaron.eco.br/servicos' }]),
    ).toHaveLength(1)
  })

  it('descarta trecho curto demais para dizer algo', () => {
    expect(limparAchados([{ ...bom, text: 'SolarOn' }])).toHaveLength(0)
  })

  /**
   * O corte em 320 não é economia de token. Contexto longo faz o modelo citar
   * detalhe irrelevante para provar que leu, e "vi que vocês atendem Curitiba
   * desde 2014" numa primeira resposta soa a vigilância.
   */
  it('corta o trecho em 320 caracteres', () => {
    const longo = limparAchados([{ ...bom, text: 'a'.repeat(2000) }])
    expect(longo[0].trecho).toHaveLength(320)
  })

  it('respeita o teto de achados', () => {
    const muitos = Array.from({ length: 10 }, (_, i) => ({ ...bom, url: `https://e${i}.com.br/` }))
    expect(limparAchados(muitos)).toHaveLength(3)
    expect(limparAchados(muitos, 1)).toHaveLength(1)
  })

  it('ignora URL quebrada em vez de estourar', () => {
    expect(() => limparAchados([{ ...bom, url: 'nao é url' }])).not.toThrow()
    expect(limparAchados([{ ...bom, url: 'nao é url' }])).toHaveLength(0)
  })
})

describe('o bloco que vai para o prompt', () => {
  /**
   * Vazio quando não houve achado, e essa é a decisão que evita o pior caso:
   * um bloco dizendo "não encontrei informações" convida o modelo a comentar a
   * ausência — "não achei muito sobre vocês, mas..." —, que é pior que não
   * mencionar nada.
   */
  it('é vazio quando não achou nada', () => {
    expect(contextoParaOPrompt([])).toBe('')
  })

  it('proíbe dizer que pesquisou', () => {
    const c = contextoParaOPrompt([{ titulo: 'SolarOn', url: 'https://x', trecho: 'faz solar' }])
    expect(c).toMatch(/Nunca diga "vi no site de vocês"/)
  })

  /** O que a pessoa diz vale mais que o que o site dela diz. */
  it('manda acreditar na pessoa quando houver divergência', () => {
    const c = contextoParaOPrompt([{ titulo: 'X', url: 'https://x', trecho: 'faz solar' }])
    expect(c).toMatch(/acredite NELA/)
  })
})

describe('quando pesquisar', () => {
  /**
   * Uma busca por CONVERSA, nunca por mensagem. Sem esta trava, uma conversa
   * de vinte mensagens custaria vinte buscas para descobrir a mesma coisa — e
   * o crédito do Exa acabou em 10/09 por consumo que ninguém contabilizou por
   * chamada.
   */
  it('não repete a busca na mesma conversa', () => {
    expect(devePesquisar({ jaPesquisou: true, mensagensNaConversa: 1 })).toBe(false)
  })

  it('pesquisa nas duas primeiras mensagens', () => {
    expect(devePesquisar({ jaPesquisou: false, mensagensNaConversa: 1 })).toBe(true)
    expect(devePesquisar({ jaPesquisou: false, mensagensNaConversa: 2 })).toBe(true)
  })

  /** Depois disso a pessoa já disse quem é, e isso vale mais que o site. */
  it('para de pesquisar quando a conversa já andou', () => {
    expect(devePesquisar({ jaPesquisou: false, mensagensNaConversa: 5 })).toBe(false)
  })
})
