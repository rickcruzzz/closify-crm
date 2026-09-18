import { describe, expect, it } from 'vitest'

import {
  PASSOS_DO_GUIA,
  concluidosNoGuia,
  guiaCumprido,
  LARGURA_DO_CARTAO,
  MARGEM_DA_JANELA,
  lerVisitadas,
  montarGuia,
  naRotaDoPasso,
  passoAtivo,
  posicionarCartao,
  visitaCumpridaEm,
  type EstadoDoGuia,
} from '@/lib/onboarding/guia'

const VAZIO: EstadoDoGuia = {
  sinais: { leads: 0, negocios: 0, orcamentos: 0 },
  visitadas: [],
  temMax: false,
}

function com(parcial: Partial<EstadoDoGuia>): EstadoDoGuia {
  return { ...VAZIO, ...parcial, sinais: { ...VAZIO.sinais, ...parcial.sinais } }
}

describe('montarGuia', () => {
  it('conta vazia comeca no primeiro contato', () => {
    const passos = montarGuia(VAZIO)
    expect(passoAtivo(passos)?.chave).toBe('contato')
    expect(concluidosNoGuia(passos)).toBe(0)
  })

  /**
   * O caso que justifica a derivacao.
   *
   * Quem importa uma planilha antes de o guia comecar ja tem contato. Um
   * `boolean` gravado no clique de "criar contato" nao saberia disso e mandaria
   * a pessoa cadastrar um contato que ela ja tem, 50 vezes.
   */
  it('quem ja importou contatos pula o passo 1 sem caso especial', () => {
    const passos = montarGuia(com({ sinais: { leads: 50, negocios: 0, orcamentos: 0 } }))
    expect(passos[0]!.concluido).toBe(true)
    expect(passoAtivo(passos)?.chave).toBe('negocio')
  })

  /**
   * O espelho do caso acima, e o motivo de a conclusao nunca ser gravada.
   *
   * Apagar o unico contato desfaz o passo. Um marcador continuaria dizendo
   * "feito" sobre um CRM que voltou a estar vazio.
   */
  it('apagar o unico contato devolve o passo 1', () => {
    const passos = montarGuia(VAZIO)
    expect(passos[0]!.concluido).toBe(false)
  })

  it('sem o Max, o passo de conversas nao entra na lista', () => {
    const passos = montarGuia(VAZIO)
    expect(passos.map((p) => p.chave)).not.toContain('conversas')
    expect(passos).toHaveLength(PASSOS_DO_GUIA.length - 1)
  })

  it('com o Max, conversas entra', () => {
    const passos = montarGuia(com({ temMax: true }))
    expect(passos.map((p) => p.chave)).toContain('conversas')
    expect(passos).toHaveLength(PASSOS_DO_GUIA.length)
  })

  /**
   * O contador precisa poder chegar ao fim.
   *
   * Com o indice vindo da lista ORIGINAL, quem nao tem Max veria "6 de 6"
   * inalcancavel: o passo 5 nao existe para ela, e o ultimo carregaria o
   * indice 5 numa lista de cinco.
   */
  it('o indice sai da lista filtrada, nao da original', () => {
    const passos = montarGuia(VAZIO)
    expect(passos.map((p) => p.indice)).toEqual([0, 1, 2, 3, 4])
    expect(passos.at(-1)!.chave).toBe('resultados')
  })

  it('visita cumprida marca o passo, e so aquele', () => {
    const passos = montarGuia(com({ visitadas: ['hoje'] }))
    expect(passos.find((p) => p.chave === 'hoje')!.concluido).toBe(true)
    expect(passos.find((p) => p.chave === 'resultados')!.concluido).toBe(false)
  })

  it('tudo feito cumpre o guia', () => {
    const passos = montarGuia(
      com({
        sinais: { leads: 1, negocios: 1, orcamentos: 1 },
        visitadas: ['hoje', 'resultados'],
      }),
    )
    expect(guiaCumprido(passos)).toBe(true)
    expect(passoAtivo(passos)).toBeNull()
  })

  /**
   * `every` sobre lista vazia devolve `true`, entao sem o guard uma lista sem
   * passo nenhum seria "cumprida" e o produto anunciaria parabens por nada.
   */
  it('lista vazia nao conta como cumprida', () => {
    expect(guiaCumprido([])).toBe(false)
  })

  /**
   * Fora de ordem continua valendo.
   *
   * Quem cria negocio antes de contato (impossivel hoje, o formulario exige o
   * contato) ou visita Hoje por conta propria nao deve ser mandado de volta.
   */
  it('passo posterior concluido sozinho nao arrasta o guia para frente', () => {
    const passos = montarGuia(com({ visitadas: ['resultados'] }))
    expect(passoAtivo(passos)?.chave).toBe('contato')
    expect(passos.find((p) => p.chave === 'resultados')!.concluido).toBe(true)
  })
})

describe('naRotaDoPasso', () => {
  const contatos = PASSOS_DO_GUIA[0]!

  it('a propria rota serve', () => {
    expect(naRotaDoPasso(contatos, '/leads')).toBe(true)
  })

  /** Abrir o contato recem-criado nao pode tirar a pessoa do passo. */
  it('a rota filha serve', () => {
    expect(naRotaDoPasso(contatos, '/leads/abc-123')).toBe(true)
  })

  it('outra rota nao serve', () => {
    expect(naRotaDoPasso(contatos, '/kanban')).toBe(false)
  })

  /**
   * O controle que o prefixo exige.
   *
   * Sem a barra no final, `startsWith('/leads')` casaria com uma rota futura
   * chamada `/leadscore`, e o guia apontaria para um botao que nao esta la.
   */
  it('rota que so comeca com o mesmo texto nao serve', () => {
    expect(naRotaDoPasso(contatos, '/leadscore')).toBe(false)
  })
})

describe('visitaCumpridaEm', () => {
  it('reconhece a tela de hoje', () => {
    expect(visitaCumpridaEm('/hoje')).toBe('hoje')
  })

  it('reconhece resultados', () => {
    expect(visitaCumpridaEm('/dashboard')).toBe('resultados')
  })

  /** Rota de passo de DADO nao vira visita: o contato so conta quando existe. */
  it('a tela de contatos nao cumpre nada por ser visitada', () => {
    expect(visitaCumpridaEm('/leads')).toBeNull()
  })

  it('rota fora do guia nao cumpre nada', () => {
    expect(visitaCumpridaEm('/settings')).toBeNull()
  })
})

/**
 * O `jsonb` e livre, e o guia e montado no layout do dashboard: um `throw`
 * aqui derrubaria TODA tela logada, nao so o guia.
 */
describe('lerVisitadas', () => {
  it('le a lista gravada', () => {
    expect(lerVisitadas({ guia: { visitadas: ['hoje', 'resultados'] } })).toEqual([
      'hoje',
      'resultados',
    ])
  })

  it('respostas sem guia devolve lista vazia', () => {
    expect(lerVisitadas({ nomeEmpresa: 'Marcenaria Silva' })).toEqual([])
  })

  it('nulo devolve lista vazia', () => {
    expect(lerVisitadas(null)).toEqual([])
  })

  it('formato errado no lugar da lista devolve lista vazia', () => {
    expect(lerVisitadas({ guia: { visitadas: 'hoje' } })).toEqual([])
    expect(lerVisitadas({ guia: 7 })).toEqual([])
  })

  /** Passo renomeado numa versao anterior nao pode voltar como chave viva. */
  it('descarta chave que nao e passo do guia', () => {
    expect(lerVisitadas({ guia: { visitadas: ['hoje', 'calendario', 42] } })).toEqual([
      'hoje',
    ])
  })
})

/**
 * A geometria do cartao, que e onde este tipo de recurso quebra em silencio.
 *
 * Um alvo na quina da janela empurra o cartao para fora da tela sem erro
 * nenhum no console: a pessoa ve o veu escurecer, o destaque aparecer, e a
 * instrucao em lugar nenhum. O requisito de "nunca deixar o tooltip fora da
 * tela" e exatamente isto.
 */
describe('posicionarCartao', () => {
  const JANELA = { largura: 1440, altura: 900 }
  const ALTURA = 200
  const L = LARGURA_DO_CARTAO

  function pos(recorte: Parameters<typeof posicionarCartao>[0]['recorte'], janela = JANELA) {
    return posicionarCartao({ recorte, alturaDoCartao: ALTURA, largura: L, janela })
  }

  it('sem alvo, o cartao vai para o rodape e centraliza', () => {
    expect(pos(null)).toEqual({
      top: JANELA.altura - ALTURA - MARGEM_DA_JANELA,
      left: (JANELA.largura - L) / 2,
    })
  })

  it('alvo no topo poe o cartao ABAIXO dele', () => {
    const r = { top: 80, left: 700, width: 160, height: 40 }
    expect(pos(r).top).toBeGreaterThan(r.top + r.height)
  })

  it('alvo no rodape poe o cartao ACIMA dele', () => {
    const r = { top: 800, left: 700, width: 160, height: 40 }
    expect(pos(r).top).toBeLessThan(r.top)
    expect(pos(r).top).toBeGreaterThanOrEqual(MARGEM_DA_JANELA)
  })

  /**
   * Alvo alto demais nao cabe nem embaixo nem em cima. Sem o terceiro caminho,
   * o calculo devolveria um `top` negativo e o cartao sairia pelo topo.
   */
  it('alvo que ocupa a tela inteira cai no rodape, nunca fora dela', () => {
    const r = { top: 10, left: 700, width: 160, height: 880 }
    const p = pos(r)
    expect(p.top).toBeGreaterThanOrEqual(MARGEM_DA_JANELA)
    expect(p.top + ALTURA).toBeLessThanOrEqual(JANELA.altura)
  })

  it('alvo colado na borda esquerda nao empurra o cartao para fora', () => {
    expect(pos({ top: 200, left: 0, width: 40, height: 40 }).left).toBe(MARGEM_DA_JANELA)
  })

  it('alvo colado na borda direita nao empurra o cartao para fora', () => {
    const p = pos({ top: 200, left: JANELA.largura - 40, width: 40, height: 40 })
    expect(p.left + L).toBeLessThanOrEqual(JANELA.largura - MARGEM_DA_JANELA)
  })

  /**
   * O caso do celular estreito: com 300px de largura o cartao nao cabe com as
   * duas margens. Sem o `Math.max` externo o `clamp` devolveria um valor menor
   * que a margem, ou seja um cartao comecando fora da tela pela esquerda.
   */
  it('janela mais estreita que o cartao mantem o inicio dentro da tela', () => {
    const p = pos({ top: 100, left: 250, width: 40, height: 40 }, { largura: 300, altura: 640 })
    expect(p.left).toBe(MARGEM_DA_JANELA)
  })

  /** Antes da primeira medicao a janela e 0x0, e dividir por ela daria NaN. */
  it('janela ainda nao medida devolve a margem, e nao NaN', () => {
    const p = pos({ top: 0, left: 0, width: 10, height: 10 }, { largura: 0, altura: 0 })
    expect(p).toEqual({ top: MARGEM_DA_JANELA, left: MARGEM_DA_JANELA })
  })
})
