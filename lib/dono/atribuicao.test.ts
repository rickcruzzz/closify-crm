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
    veioDeCliqueDeAnuncio: false,
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

  it('sem gasto nenhum, não inventa custo', () => {
    const r = resumirAtribuicao([], [], MENSALIDADE)
    expect(r.gastoTotal).toBe(0)
    expect(r.custoPorCliente).toBeNull()
    expect(r.mesesParaSePagar).toBeNull()
  })
})
