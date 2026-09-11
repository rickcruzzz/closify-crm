import { describe, expect, it } from 'vitest'

import {
  amostraDaColuna,
  apenasDigitos,
  chaveDeContato,
  contarAvisosDeArquivo,
  interpretarPlanilha,
  normalizarEtapa,
  sugerirMapeamento,
  temFormaDeEmail,
  temFormaDeTelefone,
  inferirPorConteudo,
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
    // A frase mudou de "foram lidas" para "vamos importar" quando o corte
    // passou a valer TAMBEM no envio: antes a tela prometia 1000 de 1500 e o
    // servidor recusava as 1500 inteiras.
    expect(erros[0]).toContain('Vamos importar as primeiras 3')
    expect(contarAvisosDeArquivo(erros)).toBe(1)
  })

  it('conta o aviso de truncamento como aviso de ARQUIVO, nao de linha', () => {
    // O que `contarAvisosDeArquivo` protege: sem isto o total de "ignorados"
    // somava uma mensagem que fala do arquivo, e ficava maior que o arquivo.
    const corpo = Array.from({ length: 9 }, (_, i) => ['Ana ' + i, `a${i}@x.com`])
    const { linhas, erros } = interpretarPlanilha(
      [['Nome', 'E-mail'], ...corpo],
      { name: 0, email: 1 },
      4,
    )
    expect(linhas).toHaveLength(4)
    expect(contarAvisosDeArquivo(erros)).toBe(1)
  })

  // `preenchidos` só existe por causa da reimportação: célula em branco não
  // pode apagar dado que já está no CRM. Sem essa lista, subir de novo uma
  // planilha com a coluna Empresa vazia limparia a empresa de todo mundo, e um
  // Valor em branco viraria R$ 0,00 por cima do valor real.
  it('marca só os campos que vieram preenchidos', () => {
    const { linhas } = interpretarPlanilha(
      [cabecalho, ['Ana', '11900000000', 'ana@x.com', '', '', '']],
      mapa,
      SEM_LIMITE,
    )
    expect(linhas[0]?.preenchidos.sort()).toEqual(['email', 'name', 'phone'])
  })

  it('valor zero escrito na planilha conta como preenchido', () => {
    const { linhas } = interpretarPlanilha(
      [['Nome', 'E-mail', 'Valor'], ['Ana', 'ana@x.com', '0']],
      { name: 0, email: 1, value: 2 },
      SEM_LIMITE,
    )
    expect(linhas[0]?.value).toBe(0)
    expect(linhas[0]?.preenchidos).toContain('value')
  })

  it('etapa em branco não conta como preenchida, mesmo caindo em "novo"', () => {
    const { linhas } = interpretarPlanilha(
      [['Nome', 'E-mail', 'Etapa'], ['Ana', 'ana@x.com', '']],
      { name: 0, email: 1, status: 2 },
      SEM_LIMITE,
    )
    expect(linhas[0]?.status).toBe('novo')
    expect(linhas[0]?.preenchidos).not.toContain('status')
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

describe('amostraDaColuna', () => {
  // Achado numa planilha de ERP real: cabeçalho mapeado por posição
  // ("Coluna 2") sem nenhuma amostra visível fazia a pessoa confiar num
  // mapeamento errado até a importação inteira falhar com "sem e-mail nem
  // telefone". A amostra existe pra pegar isso ANTES de importar.
  it('devolve o primeiro valor não-vazio da coluna', () => {
    const corpo = [
      ['', '(11) 90000-0000'],
      ['Ana', '(21) 98888-7777'],
    ]
    expect(amostraDaColuna(corpo, 1)).toBe('(11) 90000-0000')
  })

  it('pula linhas em branco até achar um valor', () => {
    const corpo = [
      ['', ''],
      ['', '   '],
      ['', 'ana@x.com'],
    ]
    expect(amostraDaColuna(corpo, 1)).toBe('ana@x.com')
  })

  it('devolve null quando a coluna está vazia em toda linha', () => {
    const corpo = [
      ['Ana', ''],
      ['João', '   '],
    ]
    expect(amostraDaColuna(corpo, 1)).toBeNull()
  })

  it('devolve null para índice fora do range da linha', () => {
    const corpo = [['Ana', 'ana@x.com']]
    expect(amostraDaColuna(corpo, 5)).toBeNull()
  })

  it('devolve null quando o corpo está vazio', () => {
    expect(amostraDaColuna([], 0)).toBeNull()
  })
})

describe('o formato do contato, e a tabela de preços que virou 108 contatos', () => {
  // Em 09/09 um cliente importou `Tabela_de_Precos_Pintura.xlsx` — 108 tintas
  // com o preço de cada fornecedor na segunda coluna — e o produto aceitou as
  // 108 como contatos. Na tela de Contatos ficou "VERNIZ 5500 / 56 | 58 |
  // 67,12 | 57,87".
  //
  // Reproduzido com o arquivo real: não havia validação de formato nenhuma.
  const tinta = [
    ['Produto', 'Preços / Observações'],
    ['AZUL COBALTO 0,5L', '75 | 104 | 82 | 99 | 145,25'],
    ['PRATA ETOILE', '45'],
    ['BRANCO CRISTAL', '46 SKY | 45 FARBEN | 49 LAZZ'],
  ]

  it('recusa a tabela de preços mapeada como E-MAIL', () => {
    const r = interpretarPlanilha(tinta, { name: 0, email: 1 }, 1000)
    expect(r.linhas).toHaveLength(0)
    expect(r.erros).toHaveLength(3)
  })

  it('recusa a mesma tabela mapeada como TELEFONE', () => {
    // Este era o pior dos dois: a regra antiga só contava dígitos, e cinco
    // preços concatenados dão catorze. Parte da planilha entrava e parte não,
    // que é mais confuso que recusar tudo.
    const r = interpretarPlanilha(tinta, { name: 0, phone: 1 }, 1000)
    expect(r.linhas).toHaveLength(0)
  })

  it('o erro CITA o que veio na célula', () => {
    // "sem e-mail nem telefone" era verdadeiro e inútil com a coluna
    // preenchida: a pessoa olha a planilha, vê algo escrito, e conclui que o
    // sistema está errado.
    const r = interpretarPlanilha(tinta, { name: 0, email: 1 }, 1000)
    expect(r.erros[0]).toContain('75 | 104 | 82 | 99 | 145,25')
    expect(r.erros[0]).toContain('não é e-mail nem telefone')
  })

  it('descarta a CÉLULA suja, não a linha inteira', () => {
    // Planilha real tem buraco. Recusar a pessoa por causa de um telefone mal
    // digitado perderia o e-mail bom que veio junto.
    const r = interpretarPlanilha(
      [
        ['Nome', 'E-mail', 'Telefone'],
        ['Ana Lima', 'ana@x.com', 'ramal 42'],
        ['Pedro Reis', 'nao-e-email', '(21) 3116-9545'],
      ],
      { name: 0, email: 1, phone: 2 },
      1000,
    )
    expect(r.linhas).toHaveLength(2)
    expect(r.linhas[0]).toMatchObject({ email: 'ana@x.com', phone: null })
    expect(r.linhas[1]).toMatchObject({ email: null, phone: '(21) 3116-9545' })
  })

  it('a planilha de contatos de verdade continua passando inteira', () => {
    // O controle que separa "apertei a regra" de "quebrei a importação".
    const r = interpretarPlanilha(
      [
        ['Nome', 'E-mail', 'Telefone'],
        ['Maria Silva', 'maria@empresa.com.br', '(11) 98765-4321'],
        ['Joao Souza', '', '11987654321'],
      ],
      { name: 0, email: 1, phone: 2 },
      1000,
    )
    expect(r.linhas).toHaveLength(2)
    expect(r.erros).toHaveLength(0)
  })

  it('e-mail: exige arroba e ponto, sem inventar RFC', () => {
    // Frouxa de propósito: e-mail exótico existe, e recusar cliente de verdade
    // é pior que deixar entrar um esquisito.
    expect(temFormaDeEmail('a@b.co')).toBe(true)
    expect(temFormaDeEmail('maria@empresa.com.br')).toBe(true)
    expect(temFormaDeEmail('nao-e-email')).toBe(false)
    expect(temFormaDeEmail('75 | 104 | 82')).toBe(false)
    expect(temFormaDeEmail('a@b')).toBe(false)
  })

  it('telefone: DDD que existe, e o 55 do país não conta como dígito', () => {
    expect(temFormaDeTelefone('(11) 98765-4321')).toBe(true)
    expect(temFormaDeTelefone('11987654321')).toBe(true)
    expect(temFormaDeTelefone('5511987654321')).toBe(true)
    // O caso real: cinco preços concatenados.
    expect(temFormaDeTelefone('751048299145')).toBe(false)
    expect(temFormaDeTelefone('45')).toBe(false)
    // DDD 00 não existe, e é o que separa "onze dígitos" de "telefone".
    expect(temFormaDeTelefone('(00) 99999-9999')).toBe(false)
  })
})

describe('compatibilidade com a exportação dos outros CRMs', () => {
  // Medido em 09/09 contra os cabeçalhos que essas ferramentas exportam de
  // verdade. O que estava faltando era inglês: `organization` (Pipedrive),
  // `amount` e `account` (Salesforce), `mobile`, `full name`.
  const campos = (cabecalho: string[]) => {
    const m = sugerirMapeamento(cabecalho)
    return Object.fromEntries(
      (['name', 'email', 'phone', 'company', 'value', 'status'] as const)
        .filter((c) => m[c] !== undefined)
        .map((c) => [c, cabecalho[m[c]!]]),
    )
  }

  it('Pipedrive: `Organization` vira empresa', () => {
    // Antes de 09/09 só existia `organizacao`, em português. A empresa vinha
    // VAZIA e a importação dizia que tinha dado certo — número plausível com
    // conclusão errada, a classe de erro mais cara deste projeto.
    expect(campos(['Person - Name', 'Person - Email', 'Organization'])).toMatchObject({
      name: 'Person - Name',
      email: 'Person - Email',
      company: 'Organization',
    })
  })

  it('Salesforce: full name, mobile, account e amount', () => {
    expect(campos(['Full Name', 'Email', 'Mobile', 'Account Name', 'Amount', 'Stage'])).toMatchObject({
      name: 'Full Name',
      phone: 'Mobile',
      company: 'Account Name',
      value: 'Amount',
      status: 'Stage',
    })
  })

  it('HubSpot: pega First Name e NÃO inventa o sobrenome', () => {
    // `Last Name` fica de fora, e isso é sabido: juntar duas colunas num campo
    // é outro recurso. O que a tela faz é AVISAR que ela não entra, em vez de
    // a pessoa descobrir depois com metade dos contatos pela metade.
    const m = sugerirMapeamento(['First Name', 'Last Name', 'Email'])
    expect(m.name).toBe(0)
    expect(Object.values(m)).not.toContain(1)
  })

  it('"Nome da empresa" não rouba o campo Nome', () => {
    // O motivo de casar por igualdade antes de casar por conter: "nome" está
    // dentro de "nome da empresa", e o palpite errado é pior que palpite
    // nenhum — a pessoa confia na tela e importa o campo trocado.
    expect(campos(['Nome da empresa', 'Nome do contato', 'E-mail'])).toMatchObject({
      name: 'Nome do contato',
      company: 'Nome da empresa',
    })
  })
})

describe('inferirPorConteudo', () => {
  /** O arquivo do relato de 11/09, já lido: três colunas, zero cabeçalho. */
  const SEM_CABECALHO = [
    ['Mariana Oliveira', 'mariana@alfasolucoes.com.br', '(71) 99111-1001'],
    ['Rafael Santos', 'rafael@alfasolucoes.com.br', '(71) 99222-1002'],
  ]

  it('acha nome, e-mail e telefone sem nenhum cabeçalho', () => {
    expect(inferirPorConteudo(SEM_CABECALHO)).toEqual({ name: 0, email: 1, phone: 2 })
  })

  it('funciona com as colunas em ordem trocada', () => {
    expect(
      inferirPorConteudo([
        ['11999998888', 'ana@x.com.br', 'Ana Souza'],
        ['11988887777', 'bia@x.com.br', 'Bia Lima'],
      ]),
    ).toEqual({ phone: 0, email: 1, name: 2 })
  })

  /**
   * O caso que o pedido descreve: a coluna se chama "Contato" mas contém
   * telefones. Aqui a inferência olha só o conteúdo, e o conteúdo é telefone.
   */
  it('reconhece telefone mesmo quando o título diria outra coisa', () => {
    expect(
      inferirPorConteudo([
        ['Ana Souza', '(71) 99111-1001'],
        ['Bia Lima', '71988887777'],
      ]),
    ).toEqual({ name: 0, phone: 1 })
  })

  it('reconhece valor em reais', () => {
    expect(
      inferirPorConteudo([
        ['Ana', 'ana@x.com.br', 'R$ 1.500,00'],
        ['Bia', 'bia@x.com.br', 'R$ 2.300,50'],
      ]),
    ).toEqual({ name: 0, email: 1, value: 2 })
  })

  /**
   * O CONTROLE que impede o caso das 108 tintas de 09/09: planilha de produto
   * não tem coluna com forma de contato, e a inferência não pode inventar uma.
   */
  it('NÃO inventa e-mail nem telefone numa planilha de produto', () => {
    const m = inferirPorConteudo([
      ['Tinta Acrílica Branca', '75'],
      ['Tinta Esmalte Azul', '104'],
      ['Verniz Fosco', '82'],
    ])
    expect(m.email).toBeUndefined()
    expect(m.phone).toBeUndefined()
  })

  /** Uma célula só é coincidência: o corte exige duas. */
  it('não decide com uma linha só', () => {
    expect(inferirPorConteudo([['Ana', 'ana@x.com.br']])).toEqual({})
  })

  it('aceita matriz vazia', () => {
    expect(inferirPorConteudo([])).toEqual({})
  })

  it('respeita o início dos dados, pulando o ruído', () => {
    expect(
      inferirPorConteudo(
        [
          ['EMPRESA'],
          ['CONTATOS:'],
          ['Ana Souza', 'ana@x.com.br'],
          ['Bia Lima', 'bia@x.com.br'],
        ],
        2,
      ),
    ).toEqual({ name: 0, email: 1 })
  })
})
