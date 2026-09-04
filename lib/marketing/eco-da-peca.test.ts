import { describe, expect, it } from 'vitest'

import { ecoDaPeca, ECO_PADRAO } from './eco-da-peca'
import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

/**
 * As seis chaves são as que `scripts/marketing/criar-anuncios-meta.mjs` escreve
 * nas URLs dos anúncios, conferidas na API da Meta em 04/09.
 */
const PECAS = [
  'a1_ancora_preco',
  'a2_perda_memoria',
  'a3_objecao_planilha',
  'a4_prova_produto',
  'a5_oferta',
  'a6_google',
]

describe('ecoDaPeca', () => {
  it('tem eco próprio para as seis peças que estão no ar', () => {
    for (const peca of PECAS) {
      expect(ecoDaPeca(peca), peca).not.toEqual(ECO_PADRAO)
    }
  })

  // Seis promessas iguais não seriam seis promessas: o teste de ângulo só
  // conclui alguma coisa se cada peça continuar o SEU argumento.
  it('nenhuma peça repete o título de outra', () => {
    const titulos = PECAS.map((p) => ecoDaPeca(p).titulo)
    expect(new Set(titulos).size).toBe(PECAS.length)
  })

  // ## O ponto do funil onde o atrito é maior
  //
  // A pessoa está diante de quatro campos. É aqui que "grátis, sem cartão" vale
  // mais que qualquer benefício — e era exatamente o que a página não dizia.
  it('todo eco remove atrito, citando grátis ou o preço do Pro', () => {
    for (const peca of PECAS) {
      const { descricao } = ecoDaPeca(peca)
      expect(
        descricao.includes('rátis') || descricao.includes(`R$ ${PRO_PLAN_PRICE}`),
        `${peca}: ${descricao}`,
      ).toBe(true)
    }
  })

  // ## Prometer recurso Pro num cadastro grátis é aquisição que garante frustração
  //
  // Google Agenda e Gmail são Pro desde a migration 0034. O anúncio `a6` vende
  // os dois; sem esta linha, a pessoa cria conta grátis e descobre sozinha que
  // não conecta nada.
  it('a peça do Google declara que a conexão é do Pro', () => {
    const { descricao } = ecoDaPeca('a6_google')
    expect(descricao).toContain('Pro')
  })

  // ## Os números saem de `lib/plans.ts`, nunca escritos à mão
  //
  // Mudar o limite do Free não pode deixar seis textos mentindo numa página
  // que recebe tráfego pago.
  it('cita o limite real do Free, não um número fixo', () => {
    expect(ecoDaPeca('a5_oferta').titulo).toContain(String(FREE_LEAD_LIMIT))
    expect(ecoDaPeca('a1_ancora_preco').titulo).toContain(String(PRO_PLAN_PRICE))
  })

  describe('quem não veio de peça conhecida', () => {
    // Texto genérico e verdadeiro é melhor que específico e errado.
    it.each([
      ['nulo', null],
      ['indefinido', undefined],
      ['vazio', ''],
      ['só espaço', '   '],
      ['peça que não existe', 'a9_inventada'],
      ['tentativa de injeção', '<script>alert(1)</script>'],
    ])('cai no padrão: %s', (_, valor) => {
      expect(ecoDaPeca(valor)).toEqual(ECO_PADRAO)
    })
  })

  // Quem monta a URL digita à mão, e a Meta não garante a caixa do parâmetro.
  it('casa a peça ignorando caixa e separador', () => {
    const esperado = ecoDaPeca('a1_ancora_preco')
    expect(ecoDaPeca('A1_Ancora_Preco')).toEqual(esperado)
    expect(ecoDaPeca('a1-ancora-preco')).toEqual(esperado)
    expect(ecoDaPeca(' a1 ancora preco ')).toEqual(esperado)
  })
})
