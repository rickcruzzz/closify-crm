import { describe, expect, it } from 'vitest'

import {
  apenasDigitos,
  chaveDeContato,
  contarAvisosDeArquivo,
  interpretarPlanilha,
  normalizarEtapa,
  sugerirMapeamento,
} from './planilha'

const SEM_LIMITE = 10_000

describe('sugerirMapeamento', () => {
  it('reconhece o cabeçalho padrão', () => {
    expect(sugerirMapeamento(['Nome', 'Telefone', 'E-mail', 'Valor'])).toEqual({
      name: 0,
      phone: 1,
      email: 2,
      value: 3,
    })
  })

  // O cabeçalho fora da lista de apelidos abortava o arquivo inteiro antes.
  // Agora o palpite falha e a tela pede o mapeamento manual.
  it('reconhece os apelidos que a planilha real usa', () => {
    const m = sugerirMapeamento(['Cliente', 'Fone', 'Razão Social', 'Situação', 'Valor Proposta'])
    expect(m.name).toBe(0)
    expect(m.phone).toBe(1)
    expect(m.company).toBe(2)
    expect(m.status).toBe(3)
    expect(m.value).toBe(4)
  })

  it('ignora acento e caixa', () => {
    expect(sugerirMapeamento(['NOME', 'E-MAIL']).name).toBe(0)
    expect(sugerirMapeamento(['NOME', 'E-MAIL']).email).toBe(1)
  })

  // "nome" está contido em "nome da empresa": sem casar por igualdade antes de
  // casar por conteúdo, o palpite mandaria o nome da pessoa para a coluna
  // errada e a pessoa confiaria na tela.
  it('prefere o casamento exato ao parcial', () => {
    const m = sugerirMapeamento(['Nome da Empresa', 'Nome'])
    expect(m.name).toBe(1)
  })

  it('não mapeia duas vezes a mesma coluna', () => {
    const m = sugerirMapeamento(['Contato'])
    const usadas = Object.values(m)
    expect(new Set(usadas).size).toBe(usadas.length)
  })

  it('devolve vazio quando não reconhece nada', () => {
    expect(sugerirMapeamento(['aaa', 'bbb'])).toEqual({})
  })
})

describe('normalizarEtapa', () => {
  it('aceita as variações que a pessoa digita à mão', () => {
    expect(normalizarEtapa('Proposta enviada')).toBe('proposta_enviada')
    expect(normalizarEtapa('PROPOSTA')).toBe('proposta_enviada')
    expect(normalizarEtapa('negociação')).toBe('negociacao')
    expect(normalizarEtapa('Ganho')).toBe('fechado_ganho')
    expect(normalizarEtapa('perdido')).toBe('fechado_perdido')
  })

  // "nao" está dentro de "negociacao". Sem o casamento exato acontecer antes
  // do parcial, um lead recusado viraria negociação em andamento.
  it('não confunde "não" com "negociação"', () => {
    expect(normalizarEtapa('não')).toBe('fechado_perdido')
    expect(normalizarEtapa('negociação')).toBe('negociacao')
  })

  // Adivinhar move o negócio para "Fechado Ganho" sem ninguém ter vendido, e
  // isso mente no dashboard. Melhor devolver null e deixar quem chama avisar.
  it('devolve null para etapa desconhecida', () => {
    expect(normalizarEtapa('aguardando retorno do jurídico')).toBeNull()
    expect(normalizarEtapa('')).toBeNull()
  })
})

describe('apenasDigitos e chaveDeContato', () => {
  it('trata as escritas do mesmo telefone como uma só', () => {
    expect(apenasDigitos('(11) 90000-0000')).toBe('11900000000')
    expect(apenasDigitos('+55 11 90000-0000')).toBe('11900000000')
    expect(apenasDigitos('011 90000-0000')).toBe('11900000000')
  })

  it('usa o e-mail como chave quando existe', () => {
    expect(chaveDeContato('Ana@X.com', '11900000000')).toBe('e:ana@x.com')
  })

  it('cai no telefone quando não há e-mail', () => {
    expect(chaveDeContato(null, '(11) 90000-0000')).toBe('t:11900000000')
  })

  // Resto de célula com dois ou três dígitos não identifica ninguém; usar como
  // chave juntaria leads diferentes num só.
  it('recusa telefone curto demais para identificar', () => {
    expect(chaveDeContato(null, '123')).toBeNull()
    expect(chaveDeContato(null, null)).toBeNull()
  })
})

describe('interpretarPlanilha', () => {
  const cabecalho = ['Nome', 'Telefone', 'E-mail', 'Empresa', 'Valor', 'Etapa']
  const mapa = { name: 0, phone: 1, email: 2, company: 3, value: 4, status: 5 }

  it('lê uma linha completa', () => {
    const { linhas, erros } = interpretarPlanilha(
      [cabecalho, ['Maria Silva', '(11) 90000-0000', 'maria@acme.com.br', 'Acme', '2.500,00', 'Proposta']],
      mapa,
      SEM_LIMITE,
    )
    expect(erros).toEqual([])
    expect(linhas[0]).toMatchObject({
      linha: 2,
      name: 'Maria Silva',
      email: 'maria@acme.com.br',
      company: 'Acme',
      value: 2500,
      status: 'proposta_enviada',
    })
  })

  // A planilha do público-alvo é lista de WhatsApp. Com e-mail obrigatório,
  // um arquivo desses importava zero linhas.
  it('aceita lead com telefone e sem e-mail', () => {
    const { linhas, erros } = interpretarPlanilha(
      [['Nome', 'Telefone'], ['João Souza', '11 90000-0000']],
      { name: 0, phone: 1 },
      SEM_LIMITE,
    )
    expect(erros).toEqual([])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.email).toBeNull()
  })

  it('recusa lead sem e-mail e sem telefone', () => {
    const { linhas, erros } = interpretarPlanilha(
      [['Nome', 'Telefone'], ['João Souza', '']],
      { name: 0, phone: 1 },
      SEM_LIMITE,
    )
    expect(linhas).toHaveLength(0)
    expect(erros[0]).toContain('Linha 2')
    expect(erros[0]).toContain('não há como contatar')
  })

  it('dedupe pelo telefone quando não há e-mail', () => {
    const { linhas, erros } = interpretarPlanilha(
      [['Nome', 'Telefone'], ['João', '(11) 90000-0000'], ['Joao Souza', '11900000000']],
      { name: 0, phone: 1 },
      SEM_LIMITE,
    )
    expect(linhas).toHaveLength(1)
    expect(erros[0]).toContain('repetido na própria planilha')
  })

  it('mantém a etapa desconhecida em "novo" e avisa', () => {
    const { linhas, erros } = interpretarPlanilha(
      [['Nome', 'E-mail', 'Etapa'], ['Ana', 'ana@x.com', 'aguardando jurídico']],
      { name: 0, email: 1, status: 2 },
      SEM_LIMITE,
    )
    expect(linhas[0]?.status).toBe('novo')
    expect(erros[0]).toContain('não reconhecida')
  })

  it('exige que o Nome esteja mapeado', () => {
    const { erros } = interpretarPlanilha([['A'], ['x']], { email: 0 }, SEM_LIMITE)
    expect(erros[0]).toContain('Nome')
  })

  it('exige ao menos uma forma de contato mapeada', () => {
    const { erros } = interpretarPlanilha([['A'], ['x']], { name: 0 }, SEM_LIMITE)
    expect(erros[0]).toContain('E-mail ou a de Telefone')
  })

  it('recusa valor que não é número em vez de gravar zero', () => {
    const { linhas, erros } = interpretarPlanilha(
      [['Nome', 'E-mail', 'Valor'], ['Ana', 'ana@x.com', 'a combinar']],
      { name: 0, email: 1, value: 2 },
      SEM_LIMITE,
    )
    expect(linhas).toHaveLength(0)
    expect(erros[0]).toContain('não é um número')
  })

  // Defeito corrigido: `ignorados` somava esta mensagem, que fala do ARQUIVO e
  // não de uma linha, e o total exibido ficava maior do que o arquivo tinha.
  it('separa aviso de arquivo de linha descartada', () => {
    const corpo = Array.from({ length: 5 }, (_, i) => ['Ana ' + i, `a${i}@x.com`])
    const { erros } = interpretarPlanilha([['Nome', 'E-mail'], ...corpo], { name: 0, email: 1 }, 3)
    expect(erros[0]).toContain('só as primeiras 3 foram lidas')
    expect(contarAvisosDeArquivo(erros)).toBe(1)
  })

  it('ignora linha totalmente vazia sem reclamar', () => {
    const { linhas, erros } = interpretarPlanilha(
      [['Nome', 'E-mail'], ['', ''], ['Ana', 'ana@x.com']],
      { name: 0, email: 1 },
      SEM_LIMITE,
    )
    expect(linhas).toHaveLength(1)
    expect(erros).toEqual([])
  })
})
