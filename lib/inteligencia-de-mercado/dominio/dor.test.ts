import { describe, expect, it } from 'vitest'

import { cortar, extrairSinais, RESUMO_MAX, type TrechoDoExa } from './dor'

const t = (over: Partial<TrechoDoExa>): TrechoDoExa => ({
  texto: 'A transportadora contratou um novo head de operacoes para a regiao sudeste este mes',
  url: 'https://exemplo.com.br/noticia',
  ...over,
})

describe('extrairSinais', () => {
  it('exige HTTPS na fonte', () => {
    // A fonte vira link clicável dentro do produto, servido por HTTPS. Um
    // `http` ali gera aviso de conteúdo misto no navegador.
    expect(extrairSinais([t({ url: 'http://exemplo.com.br/x' })])).toHaveLength(0)
    expect(extrairSinais([t({ url: 'nao-e-url' })])).toHaveLength(0)
  })

  it('uma fonte, um sinal', () => {
    // O Exa devolve vários highlights da MESMA página. Sem isto, a tela
    // mostraria cinco linhas dizendo a mesma coisa — o ruído que faz a pessoa
    // parar de ler a lista inteira, a mesma lição dos 8 de 11 alertas falsos.
    const mesma = 'https://exemplo.com.br/unica'
    const r = extrairSinais([t({ url: mesma }), t({ url: mesma }), t({ url: mesma })])
    expect(r).toHaveLength(1)
  })

  it('ordena alta antes de media', () => {
    // Quem lê para de ler cedo, e o primeiro item decide se a pessoa confia no
    // recurso.
    const r = extrairSinais([
      t({ url: 'https://a.com/1', texto: 'A empresa esta contratando e tem vagas abertas no time comercial agora' }),
      t({ url: 'https://b.com/2', texto: 'A empresa captou um aporte de investimento para expandir a operacao' }),
    ])
    expect(r[0].confianca).toBe('alta')
    expect(r[0].tipo).toBe('investimento')
  })

  it('devolve lista VAZIA quando nada se qualifica, e isso é resposta', () => {
    // "Sem sinal" é o resultado mais comum e precisa ser representável. Forçar
    // um sinal aqui é o que transformaria o recurso em gerador de texto.
    expect(
      extrairSinais([
        t({ texto: 'Somos lider em solucoes logisticas com mais de 20 anos de mercado no pais' }),
      ]),
    ).toEqual([])
  })

  it('respeita o teto de sinais', () => {
    const muitos = Array.from({ length: 12 }, (_, i) => t({ url: `https://x.com/${i}` }))
    expect(extrairSinais(muitos)).toHaveLength(5)
  })

  it('descarta data inválida em vez de gravar lixo', () => {
    expect(extrairSinais([t({ publicadoEm: 'ontem' })])[0].publicadoEm).toBeNull()
    expect(extrairSinais([t({ publicadoEm: '2026-03-01' })])[0].publicadoEm).toBe('2026-03-01')
  })
})

describe('cortar', () => {
  it('nunca passa do teto', () => {
    expect(cortar('a'.repeat(900), RESUMO_MAX).length).toBeLessThanOrEqual(RESUMO_MAX)
  })

  it('preserva o COMEÇO e não parte palavra ao meio', () => {
    // Mesma razão do `cortarParaCaber` de lib/erros/reportar.ts: o que importa
    // vem primeiro. Aqui o começo do highlight é onde o Exa pôs o trecho que
    // casou com a busca.
    const frase = 'A transportadora contratou um novo diretor ' + 'palavra '.repeat(100)
    const c = cortar(frase, 60)
    expect(c.startsWith('a transportadora contratou')).toBe(true)
    expect(c.endsWith('…')).toBe(true)
    expect(c).not.toMatch(/pala…$/)
  })

  it('devolve o texto inteiro quando cabe', () => {
    expect(cortar('curto e direto', RESUMO_MAX)).toBe('curto e direto')
  })
})
