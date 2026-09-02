import { describe, expect, it } from 'vitest'

import { diagnosticar, rotuloDoObjetivo } from './diagnostico-do-anuncio'
import type { CampanhaCompleta, ProntidaoDaConta } from './meta-ads'

/** Uma campanha saudável: tem conjunto, tem anúncio, otimiza por conversão. */
function campanha(over: Partial<CampanhaCompleta> = {}): CampanhaCompleta {
  return {
    id: 'c1',
    nome: 'Aquisição',
    ativa: false,
    status: 'PAUSED',
    objetivo: 'OUTCOME_SALES',
    gasto: 0,
    cliques: 0,
    alcance: 0,
    orcamentoDiario: 30,
    totalDeAnuncios: 2,
    conjuntos: [
      {
        id: 's1',
        nome: 'Brasil 25-55',
        status: 'PAUSED',
        campanhaId: 'c1',
        objetivo: 'OFFSITE_CONVERSIONS',
        orcamentoDiario: 30,
        publico: 'Brasil · 25-55 anos',
        totalDeAnuncios: 2,
      },
    ],
    ...over,
  }
}

function prontidao(over: Partial<ProntidaoDaConta> = {}): ProntidaoDaConta {
  return {
    contaId: '1',
    contaNome: 'Conta',
    moeda: 'BRL',
    fusoHorario: 'America/Sao_Paulo',
    temPixelCerto: true,
    pixelNome: 'pixel',
    pixelDisparandoDesde: null,
    eventos: [],
    campanhas: [campanha()],
    saude: {
      dados: { gastoTotal: 100, saldo: 0, tetoDeGasto: 0, status: 1, motivoDaDesativacao: 0 },
      erro: null,
    },
    serie: { dados: [], erro: null },
    publicos: { dados: [], erro: null },
    notaDaMeta: null,
    recomendacoesDaMeta: [],
    podeAgir: true,
    ...over,
  }
}

describe('diagnosticar', () => {
  it('cala quando está tudo em ordem', () => {
    // A regra que sustenta as outras: aviso que aparece sempre nao e aviso.
    expect(diagnosticar(prontidao())).toEqual([])
  })

  it('pega campanha sem anúncio, que é o estado REAL desta conta', () => {
    // Medido em 02/09: campanha + conjunto + criativo, e zero `ads`. Ligar nao
    // veicula nada, e a tela anterior mostrava o botao sem nenhum sinal disso.
    const achados = diagnosticar(prontidao({ campanhas: [campanha({ totalDeAnuncios: 0 })] }))
    expect(achados).toHaveLength(1)
    expect(achados[0].tipo).toBe('trava')
    expect(achados[0].titulo).toContain('não tem nenhum anúncio')
    expect(achados[0].campanha).toBe('Aquisição')
  })

  it('todo impedimento diz o que fazer', () => {
    // Aviso sem saida transfere o problema para quem le. Vale para todos.
    const achados = diagnosticar(
      prontidao({
        temPixelCerto: false,
        campanhas: [campanha({ totalDeAnuncios: 0, conjuntos: [] })],
      }),
    )
    expect(achados.length).toBeGreaterThan(0)
    for (const a of achados) expect(a.oQueFazer.length).toBeGreaterThan(20)
  })

  it('pega objetivo que não usa o pixel', () => {
    // O conjunto desta conta e LINK_CLICKS: a Meta busca clique barato, nao
    // conta criada. O campo so existe no CONJUNTO, e por isso a tela que
    // parava na campanha nao tinha como mostrar.
    const c = campanha()
    c.conjuntos[0].objetivo = 'LINK_CLICKS'
    const achados = diagnosticar(prontidao({ campanhas: [c] }))
    expect(achados).toHaveLength(1)
    expect(achados[0].tipo).toBe('desperdicio')
    expect(achados[0].titulo).toContain('cliques no link')
  })

  it('não reclama de saldo zero em conta que já gastou', () => {
    // Saldo zero e o normal em conta de pos-pago. Gritar ali seria o alarme
    // falso que treina a ignorar a lista inteira — a licao dos 8 de 11.
    const achados = diagnosticar(
      prontidao({
        campanhas: [campanha({ ativa: true })],
        saude: {
          dados: { gastoTotal: 500, saldo: 0, tetoDeGasto: 0, status: 1, motivoDaDesativacao: 0 },
          erro: null,
        },
      }),
    )
    expect(achados).toEqual([])
  })

  it('reclama de saldo zero quando a campanha está ativa e nada gastou', () => {
    const achados = diagnosticar(
      prontidao({
        campanhas: [campanha({ ativa: true })],
        saude: {
          dados: { gastoTotal: 0, saldo: 0, tetoDeGasto: 0, status: 1, motivoDaDesativacao: 0 },
          erro: null,
        },
      }),
    )
    expect(achados).toHaveLength(1)
    expect(achados[0].titulo).toContain('nunca gastou')
  })

  it('não inventa diagnóstico quando a saúde não pôde ser lida', () => {
    // `null` significa NAO SEI, nunca "esta zerado" — a distincao que fez a
    // Central declarar R$ 490/mes de receita com R$ 0,00 real em 30/08.
    const achados = diagnosticar(
      prontidao({
        campanhas: [campanha({ ativa: true })],
        saude: { dados: null, erro: 'a Meta caiu' },
      }),
    )
    expect(achados).toEqual([])
  })

  it('pega conta desativada', () => {
    const achados = diagnosticar(
      prontidao({
        saude: {
          dados: { gastoTotal: 0, saldo: 0, tetoDeGasto: 0, status: 2, motivoDaDesativacao: 1 },
          erro: null,
        },
      }),
    )
    expect(achados[0].titulo).toContain('não está ativa')
  })
})

describe('rotuloDoObjetivo', () => {
  it('traduz os que importam', () => {
    expect(rotuloDoObjetivo('OFFSITE_CONVERSIONS')).toBe('conversões no site')
    expect(rotuloDoObjetivo('LINK_CLICKS')).toBe('cliques no link')
  })

  it('degrada legível diante de um objetivo que a Meta inventar depois', () => {
    // A Meta acrescenta objetivo sem avisar. Devolver a chave crua deixaria
    // `OUTCOME_AWARENESS` na tela; assim vira ao menos uma frase.
    expect(rotuloDoObjetivo('OUTCOME_AWARENESS')).toBe('outcome awareness')
  })
})
