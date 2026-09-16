import { describe, expect, it } from 'vitest'

import { ehEtapaFechada, montarFunil } from './funil'
import type { FunnelStageCount } from './queries'

function etapa(
  stage: FunnelStageCount['stage'],
  count: number,
  valor = 0,
): FunnelStageCount {
  return { stage, label: stage, count, valor }
}

describe('montarFunil', () => {
  it('devolve as SEIS etapas, inclusive as vazias', () => {
    // Sumir com a etapa vazia mudaria a forma do funil conforme o dado, e a
    // pessoa perderia a referência de quantas etapas existem.
    const r = montarFunil([etapa('novo', 3)])
    expect(r.linhas).toHaveLength(6)
    expect(r.linhas.map((l) => l.quantidade)).toEqual([3, 0, 0, 0, 0, 0])
  })

  it('a etapa dominante NAO apaga as outras', () => {
    // A distribuição real medida em produção em 16/09: 110 de 132 em "novo".
    const r = montarFunil([
      etapa('novo', 110),
      etapa('contato_realizado', 7),
      etapa('proposta_enviada', 3),
      etapa('negociacao', 5),
      etapa('fechado_ganho', 4),
      etapa('fechado_perdido', 3),
    ])

    const novo = r.linhas.find((l) => l.stage === 'novo')!
    const proposta = r.linhas.find((l) => l.stage === 'proposta_enviada')!

    expect(novo.participacao).toBe(83.3)
    expect(proposta.participacao).toBe(2.3)
    // 2,3% arredondaria para quase nada na tela; o piso garante que a etapa
    // com negócio dentro sempre desenha alguma coisa.
    expect(proposta.larguraDaBarra).toBeGreaterThanOrEqual(2)
  })

  it('etapa ZERADA nao ganha o piso de largura', () => {
    // O piso existe para "pouco", não para "nada". Desenhar barra em etapa
    // vazia inventaria negócio que não existe.
    const r = montarFunil([etapa('novo', 50), etapa('negociacao', 0)])
    expect(r.linhas.find((l) => l.stage === 'negociacao')!.larguraDaBarra).toBe(0)
  })

  it('soma abertos e valor aberto SEM as etapas fechadas', () => {
    const r = montarFunil([
      etapa('novo', 10, 1000),
      etapa('negociacao', 2, 5000),
      etapa('fechado_ganho', 4, 90000),
      etapa('fechado_perdido', 1, 7000),
    ])
    expect(r.abertos).toBe(12)
    expect(r.valorAberto).toBe(6000)
  })

  it('quantidade sem valor e caso normal, nao defeito', () => {
    // 119 de 132 negócios reais estão com `value` zerado. A linha precisa
    // conseguir dizer "5 negócios, R$ 0" sem que isso quebre nada.
    const r = montarFunil([etapa('novo', 5, 0)])
    expect(r.linhas[0]!.quantidade).toBe(5)
    expect(r.linhas[0]!.valor).toBe(0)
    expect(r.vazio).toBe(false)
  })

  it('funil sem nenhum negocio e VAZIO, e nao uma linha de zeros', () => {
    const r = montarFunil([])
    expect(r.vazio).toBe(true)
    expect(r.linhas.every((l) => l.larguraDaBarra === 0)).toBe(true)
  })

  it('a participacao soma ~100 entre as etapas com negocio', () => {
    const r = montarFunil([
      etapa('novo', 1),
      etapa('negociacao', 1),
      etapa('fechado_ganho', 1),
    ])
    const soma = r.linhas.reduce((s, l) => s + l.participacao, 0)
    expect(Math.round(soma)).toBe(100)
  })
})

describe('ehEtapaFechada', () => {
  it('separa fechadas de abertas', () => {
    expect(ehEtapaFechada('fechado_ganho')).toBe(true)
    expect(ehEtapaFechada('fechado_perdido')).toBe(true)
    expect(ehEtapaFechada('negociacao')).toBe(false)
    expect(ehEtapaFechada('novo')).toBe(false)
  })
})
