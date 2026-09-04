import { describe, expect, it } from 'vitest'

import {
  cruzarCampanhasComClientes,
  resumirAtribuicao,
  type EmpresaAtribuivel,
} from './atribuicao'

const MENSALIDADE = 49

function empresa(sobrescrever: Partial<EmpresaAtribuivel> = {}): EmpresaAtribuivel {
  return {
    id: 'w1',
    nome: 'Empresa',
    utmCampaign: null,
    utmContent: null,
    veioDeCliqueDeAnuncio: false,
    ativou: false,
    pagando: false,
    criadoEm: '2026-08-20T00:00:00Z',
    ...sobrescrever,
  }
}

const campanha = (
  sobrescrever: Partial<{
    id: string
    nome: string
    ativa: boolean
    gasto: number
    cliques: number
    orcamentoDiario: number | null
  }> = {},
) => ({
  id: 'c1',
  nome: 'Funil frio',
  ativa: true,
  gasto: 200,
  cliques: 100,
  orcamentoDiario: null,
  ...sobrescrever,
})

describe('cruzarCampanhasComClientes', () => {
  it('calcula custo por cadastro, por cliente e o payback', () => {
    const [r] = cruzarCampanhasComClientes(
      [campanha({ gasto: 200 })],
      [
        empresa({ id: 'a', utmCampaign: 'Funil frio', pagando: true }),
        empresa({ id: 'b', utmCampaign: 'Funil frio', pagando: false }),
        empresa({ id: 'c', utmCampaign: 'Funil frio', pagando: false }),
        empresa({ id: 'd', utmCampaign: 'Outra campanha', pagando: true }),
      ],
      MENSALIDADE,
    )

    expect(r.cadastros).toBe(3)
    expect(r.clientesPagantes).toBe(1)
    expect(r.custoPorCadastro).toBeCloseTo(200 / 3)
    expect(r.custoPorCliente).toBe(200)
    // R$200 para ganhar um cliente de R$49/mês: pouco mais de 4 meses.
    expect(r.mesesParaSePagar).toBeCloseTo(200 / 49)
  })

  // ## O caso REAL, medido na API da Meta em 04/09
  //
  // A campanha se chama `Velo Funil — aquisicao (cadastro)` e os seis criativos
  // apontam para `...&utm_campaign=aquisicao_cadastro`. Espaço, travessão e
  // parêntese não cabem numa URL: os dois NUNCA vão ser idênticos por escrito.
  //
  // Com igualdade exata, os seis anúncios reportariam zero — a campanha
  // apareceria com gasto e nenhum resultado, e a tabela por peça, vazia.
  describe('o nome da campanha e o utm_campaign nunca são idênticos', () => {
    const REAL = 'Velo Funil — aquisicao (cadastro)'

    it('casa a campanha real com o utm_campaign real dos seis criativos', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ nome: REAL })],
        [empresa({ utmCampaign: 'aquisicao_cadastro', utmContent: 'a1_ancora_preco', pagando: true })],
        MENSALIDADE,
      )

      expect(r.cadastros).toBe(1)
      expect(r.clientesPagantes).toBe(1)
      expect(r.pecas[0].rotulo).toBe('a1_ancora_preco')
    })

    it('ignora acento dos dois lados', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ nome: 'Aquisição — Cadastro' })],
        [empresa({ utmCampaign: 'aquisicao-cadastro' })],
        MENSALIDADE,
      )
      expect(r.cadastros).toBe(1)
    })

    // ## A trava: ambiguidade não vira palpite
    //
    // Atribuir ao acaso poria receita de uma campanha na conta de outra, e a
    // decisão seguinte seria pausar justamente a que funciona.
    it('não atribui quando duas campanhas casam com o mesmo utm', () => {
      const desempenho = cruzarCampanhasComClientes(
        [
          campanha({ id: 'c1', nome: 'Velo Funil — aquisicao (cadastro)' }),
          campanha({ id: 'c2', nome: 'Teste aquisicao cadastro frio' }),
        ],
        [empresa({ utmCampaign: 'aquisicao_cadastro' })],
        MENSALIDADE,
      )

      expect(desempenho.map((c) => c.cadastros)).toEqual([0, 0])
    })

    // `pro` é substring de `producao`. Casar por pedaço de palavra atribuiria o
    // cliente à campanha errada — pior que não atribuir, porque parece resultado.
    it('não casa por pedaço de palavra', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ nome: 'Campanha de producao' })],
        [empresa({ utmCampaign: 'pro' })],
        MENSALIDADE,
      )
      expect(r.cadastros).toBe(0)
    })

    // Com o filtro por campanha, a mesma empresa podia casar com duas e as duas
    // contariam o mesmo pagante — a soma mostraria mais clientes do que existem.
    it('cada empresa entra em UMA campanha só', () => {
      const empresas = [empresa({ id: 'a', utmCampaign: 'aquisicao_cadastro', pagando: true })]
      const desempenho = cruzarCampanhasComClientes(
        [campanha({ id: 'c1', nome: REAL }), campanha({ id: 'c2', nome: 'Outra' })],
        empresas,
        MENSALIDADE,
      )

      const soma = desempenho.reduce((t, c) => t + c.clientesPagantes, 0)
      expect(soma).toBe(1)
    })
  })

  // Quem monta a URL do anúncio digita à mão, e um espaço a mais não pode
  // fazer um cliente pagante sumir do relatório.
  it('casa a campanha ignorando maiúscula e espaço nas pontas', () => {
    const [r] = cruzarCampanhasComClientes(
      [campanha({ nome: 'Funil Frio' })],
      [empresa({ utmCampaign: '  funil frio ', pagando: true })],
      MENSALIDADE,
    )

    expect(r.cadastros).toBe(1)
    expect(r.clientesPagantes).toBe(1)
  })

  it('não divide por zero quando ninguém se cadastrou', () => {
    const [r] = cruzarCampanhasComClientes([campanha()], [], MENSALIDADE)

    expect(r.cadastros).toBe(0)
    expect(r.custoPorCadastro).toBeNull()
    expect(r.custoPorCliente).toBeNull()
    expect(r.mesesParaSePagar).toBeNull()
  })

  describe('desperdício', () => {
    it('acusa campanha que gastou de verdade e não trouxe ninguém', () => {
      const [r] = cruzarCampanhasComClientes([campanha({ gasto: 200 })], [], MENSALIDADE)
      expect(r.desperdicio).toBe(true)
    })

    // Campanha nova que gastou R$2 não provou nada ainda. Acusar aqui faria o
    // dono pausar antes do algoritmo sequer sair da fase de aprendizado.
    it('não acusa campanha que mal começou a gastar', () => {
      const [r] = cruzarCampanhasComClientes([campanha({ gasto: 12 })], [], MENSALIDADE)
      expect(r.desperdicio).toBe(false)
    })

    it('não acusa campanha que gastou e trouxe gente', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ gasto: 500 })],
        [empresa({ utmCampaign: 'Funil frio' })],
        MENSALIDADE,
      )
      expect(r.desperdicio).toBe(false)
    })
  })

  // ## Ativação: o degrau que separa dois fracassos que parecem iguais
  //
  // Sem ele, "20 cadastros" e "4 cadastros" só se comparam pelo volume, e a
  // peça que traz muita gente que nunca usa o produto ganha o relatório.
  describe('ativação', () => {
    it('conta quem ativou separado de quem paga, e o custo de cada um', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ gasto: 300 })],
        [
          empresa({ id: 'a', utmCampaign: 'Funil frio', ativou: true, pagando: true }),
          empresa({ id: 'b', utmCampaign: 'Funil frio', ativou: true, pagando: false }),
          empresa({ id: 'c', utmCampaign: 'Funil frio', ativou: false, pagando: false }),
        ],
        MENSALIDADE,
      )

      expect(r.cadastros).toBe(3)
      expect(r.ativaram).toBe(2)
      expect(r.clientesPagantes).toBe(1)
      expect(r.custoPorAtivacao).toBe(150)
      expect(r.custoPorCliente).toBe(300)
    })

    it('não inventa custo por ativação quando ninguém ativou', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ gasto: 300 })],
        [empresa({ utmCampaign: 'Funil frio', ativou: false })],
        MENSALIDADE,
      )

      expect(r.ativaram).toBe(0)
      expect(r.custoPorAtivacao).toBeNull()
    })
  })

  // ## As peças: o motivo desta rodada existir
  //
  // Os seis criativos apontam para o mesmo `/cadastro` e só se distinguem por
  // `utm_content`. A coluna existe desde a migration 0069 e nunca foi lida —
  // até 04/09 o relatório juntava os seis num número só, e o teste de seis
  // argumentos rodaria sem concluir qual deles vendeu.
  describe('desdobramento por peça', () => {
    it('quebra a campanha nas peças que trouxeram cada conta', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ nome: 'Funil frio' })],
        [
          empresa({ id: 'a', utmCampaign: 'Funil frio', utmContent: 'a1_ancora_preco', ativou: true, pagando: true }),
          empresa({ id: 'b', utmCampaign: 'Funil frio', utmContent: 'a1_ancora_preco', ativou: true }),
          empresa({ id: 'c', utmCampaign: 'Funil frio', utmContent: 'a2_perda_memoria' }),
        ],
        MENSALIDADE,
      )

      expect(r.pecas).toHaveLength(2)
      expect(r.pecas[0]).toMatchObject({
        rotulo: 'a1_ancora_preco',
        cadastros: 2,
        ativaram: 2,
        clientesPagantes: 1,
      })
      expect(r.pecas[1]).toMatchObject({
        rotulo: 'a2_perda_memoria',
        cadastros: 1,
        ativaram: 0,
        clientesPagantes: 0,
      })
    })

    // O caso que decide o dinheiro: a peça de mais VOLUME não é a que vence.
    it('ordena por pagante, não por cadastro', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ nome: 'C' })],
        [
          ...Array.from({ length: 5 }, (_, i) =>
            empresa({ id: `vol${i}`, utmCampaign: 'C', utmContent: 'muito_volume' }),
          ),
          empresa({ id: 'p', utmCampaign: 'C', utmContent: 'pouco_e_bom', pagando: true }),
        ],
        MENSALIDADE,
      )

      expect(r.pecas.map((p) => p.rotulo)).toEqual(['pouco_e_bom', 'muito_volume'])
    })

    // Quem monta a URL digita à mão, mesmo motivo do casamento de campanha.
    it('agrupa a mesma peça escrita com caixa e espaço diferentes', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ nome: 'C' })],
        [
          empresa({ id: 'a', utmCampaign: 'C', utmContent: 'A1_Ancora_Preco' }),
          empresa({ id: 'b', utmCampaign: 'C', utmContent: ' a1_ancora_preco ' }),
        ],
        MENSALIDADE,
      )

      expect(r.pecas).toHaveLength(1)
      expect(r.pecas[0].cadastros).toBe(2)
      // O rótulo é o valor CRU da primeira ocorrência: é assim que a peça
      // aparece no Gerenciador da Meta, e é lá que o dono vai procurar.
      expect(r.pecas[0].rotulo).toBe('A1_Ancora_Preco')
    })

    // ## O caso que separa "corrigi" de "escondi"
    //
    // Descartar quem não tem `utm_content` faria o total das peças ficar menor
    // que o da campanha, sem nada na tela explicando — e o gasto continuaria
    // inteiro no denominador, deixando toda peça melhor do que é.
    it('mostra quem veio pela campanha sem dizer a peça, e não o chama de peça', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ nome: 'C' })],
        [
          empresa({ id: 'a', utmCampaign: 'C', utmContent: 'a1', pagando: true }),
          empresa({ id: 'b', utmCampaign: 'C', utmContent: null }),
          empresa({ id: 'c', utmCampaign: 'C', utmContent: '  ' }),
        ],
        MENSALIDADE,
      )

      const somaDasPecas = r.pecas.reduce((total, p) => total + p.cadastros, 0)
      expect(somaDasPecas).toBe(r.cadastros)

      const naoIdentificada = r.pecas.find((p) => !p.identificada)
      expect(naoIdentificada?.cadastros).toBe(2)
      expect(naoIdentificada?.rotulo).toBe('Peça não identificada')
    })

    // Controle negativo da ordenação: mesmo ganhando em cadastro E em pagante,
    // o balde desce. Ele não é um criativo que venceu, é o que a URL não disse.
    it('mantém o balde não identificado por último mesmo quando ele lidera', () => {
      const [r] = cruzarCampanhasComClientes(
        [campanha({ nome: 'C' })],
        [
          empresa({ id: 'a', utmCampaign: 'C', utmContent: null, pagando: true }),
          empresa({ id: 'b', utmCampaign: 'C', utmContent: null, pagando: true }),
          empresa({ id: 'c', utmCampaign: 'C', utmContent: 'a1' }),
        ],
        MENSALIDADE,
      )

      expect(r.pecas.map((p) => p.identificada)).toEqual([true, false])
    })

    it('campanha sem ninguém não inventa peça nenhuma', () => {
      const [r] = cruzarCampanhasComClientes([campanha()], [], MENSALIDADE)
      expect(r.pecas).toEqual([])
    })
  })
})

describe('resumirAtribuicao', () => {
  it('soma as campanhas e calcula o custo por cliente do conjunto', () => {
    const empresas = [
      empresa({ id: 'a', utmCampaign: 'A', pagando: true }),
      empresa({ id: 'b', utmCampaign: 'B', pagando: true }),
      empresa({ id: 'c', utmCampaign: 'B', pagando: false }),
    ]
    const desempenho = cruzarCampanhasComClientes(
      [campanha({ id: 'c1', nome: 'A', gasto: 100 }), campanha({ id: 'c2', nome: 'B', gasto: 300 })],
      empresas,
      MENSALIDADE,
    )

    const r = resumirAtribuicao(desempenho, empresas, MENSALIDADE)

    expect(r.gastoTotal).toBe(400)
    expect(r.cadastros).toBe(3)
    expect(r.clientesPagantes).toBe(2)
    expect(r.custoPorCliente).toBe(200)
  })

  // O aviso de que a URL do anúncio está incompleta: veio clique de anúncio,
  // mas sem `utm_campaign` não dá para dizer de qual campanha.
  it('conta quem veio de anúncio sem campanha identificada', () => {
    const empresas = [
      empresa({ id: 'a', veioDeCliqueDeAnuncio: true, utmCampaign: null }),
      empresa({ id: 'b', veioDeCliqueDeAnuncio: true, utmCampaign: 'A' }),
      empresa({ id: 'c', veioDeCliqueDeAnuncio: false, utmCampaign: null }),
    ]

    expect(resumirAtribuicao([], empresas, MENSALIDADE).semCampanhaIdentificada).toBe(1)
  })

  it('soma a ativação das campanhas', () => {
    const empresas = [
      empresa({ id: 'a', utmCampaign: 'A', ativou: true }),
      empresa({ id: 'b', utmCampaign: 'B', ativou: true }),
      empresa({ id: 'c', utmCampaign: 'B', ativou: false }),
    ]
    const desempenho = cruzarCampanhasComClientes(
      [campanha({ id: 'c1', nome: 'A' }), campanha({ id: 'c2', nome: 'B' })],
      empresas,
      MENSALIDADE,
    )

    expect(resumirAtribuicao(desempenho, empresas, MENSALIDADE).ativaram).toBe(2)
  })

  // ## O aviso um nível abaixo do de campanha
  //
  // A campanha bate, a peça não: o total está certo e o que falta é saber qual
  // criativo pagou por ele.
  it('conta quem veio pela campanha sem peça identificada', () => {
    const empresas = [
      empresa({ id: 'a', utmCampaign: 'A', utmContent: null }),
      empresa({ id: 'b', utmCampaign: 'A', utmContent: 'a1' }),
    ]
    const desempenho = cruzarCampanhasComClientes([campanha({ nome: 'A' })], empresas, MENSALIDADE)

    expect(resumirAtribuicao(desempenho, empresas, MENSALIDADE).semPecaIdentificada).toBe(1)
  })

  // ## A armadilha que o cálculo por `empresas` teria caído
  //
  // TODA conta orgânica tem `utm_content` nulo. Contar direto na lista de
  // empresas somaria o cadastro que nunca viu um anúncio, e o aviso passaria a
  // acusar um defeito de URL que não existe — número plausível, conclusão
  // errada, a classe de erro mais cara deste projeto.
  it('não acusa quem nunca veio de anúncio nenhum', () => {
    const empresas = [
      empresa({ id: 'organica1', utmCampaign: null, utmContent: null }),
      empresa({ id: 'organica2', utmCampaign: null, utmContent: null }),
    ]
    const desempenho = cruzarCampanhasComClientes([campanha({ nome: 'A' })], empresas, MENSALIDADE)

    expect(resumirAtribuicao(desempenho, empresas, MENSALIDADE).semPecaIdentificada).toBe(0)
  })

  // ## O alarme que separa "campanha ruim" de "relatório cego"
  //
  // A URL está completa, o dado chegou inteiro, e mesmo assim não fecha —
  // porque o nome não corresponde a campanha nenhuma da conta. Sem este
  // número, a decisão seguinte seria pausar uma campanha que funciona.
  it('acusa utm_campaign que não bate com campanha nenhuma', () => {
    const empresas = [
      empresa({ id: 'a', utmCampaign: 'campanha_que_nao_existe' }),
      empresa({ id: 'b', utmCampaign: 'Funil frio' }),
    ]
    const desempenho = cruzarCampanhasComClientes(
      [campanha({ nome: 'Funil frio' })],
      empresas,
      MENSALIDADE,
    )
    const r = resumirAtribuicao(desempenho, empresas, MENSALIDADE)

    expect(r.cadastros).toBe(1)
    expect(r.comCampanhaNaoReconhecida).toBe(1)
  })

  // Controle negativo: com tudo casando, o alarme fica calado. Sem este caso,
  // um alarme que acende sempre seria indistinguível de um que funciona.
  it('cala quando todo utm_campaign bate', () => {
    const empresas = [empresa({ id: 'a', utmCampaign: 'aquisicao_cadastro' })]
    const desempenho = cruzarCampanhasComClientes(
      [campanha({ nome: 'Velo Funil — aquisicao (cadastro)' })],
      empresas,
      MENSALIDADE,
    )

    expect(resumirAtribuicao(desempenho, empresas, MENSALIDADE).comCampanhaNaoReconhecida).toBe(0)
  })

  // Conta orgânica não tem `utm_campaign`, então não pode acender o alarme.
  it('não acusa quem chegou sem utm nenhum', () => {
    const empresas = [empresa({ id: 'o1' }), empresa({ id: 'o2' })]
    expect(
      resumirAtribuicao([], empresas, MENSALIDADE).comCampanhaNaoReconhecida,
    ).toBe(0)
  })

  it('sem gasto nenhum, não inventa custo', () => {
    const r = resumirAtribuicao([], [], MENSALIDADE)
    expect(r.gastoTotal).toBe(0)
    expect(r.custoPorCliente).toBeNull()
    expect(r.mesesParaSePagar).toBeNull()
    expect(r.ativaram).toBe(0)
    expect(r.semPecaIdentificada).toBe(0)
  })
})
