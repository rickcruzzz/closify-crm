import { describe, expect, it } from 'vitest'

import { medidasDeDesempenho, type DesempenhoCru } from './desempenho'

const NADA: DesempenhoCru = {
  valorGanho: 0,
  valorPerdido: 0,
  negociosGanhos: 0,
  negociosPerdidos: 0,
  ticketMedio: null,
  diasAteFechar: null,
}

const chaves = (c: DesempenhoCru) => medidasDeDesempenho(c).map((m) => m.chave)

describe('medidasDeDesempenho', () => {
  it('empresa sem fechamento nenhum nao mostra medida nenhuma', () => {
    // Zero não é "vendemos R$ 0", é "ainda não vendemos". Mesma lição de
    // `textoDaConversao`, aqui aplicada ao painel inteiro.
    expect(medidasDeDesempenho(NADA)).toEqual([])
  })

  it('ticket medio exige TRES ganhos', () => {
    // Com um ganho só, "ticket médio" é o valor daquele negócio com nome de
    // estatística — o mesmo defeito dos "100% de conversão" de um caso.
    const doisGanhos: DesempenhoCru = {
      ...NADA,
      negociosGanhos: 2,
      valorGanho: 20000,
      ticketMedio: 10000,
    }
    expect(chaves(doisGanhos)).not.toContain('ticket')

    const tresGanhos = { ...doisGanhos, negociosGanhos: 3, valorGanho: 30000 }
    expect(chaves(tresGanhos)).toContain('ticket')
  })

  it('o ticket declara a base, para o numero nao passar por lei', () => {
    const m = medidasDeDesempenho({
      ...NADA,
      negociosGanhos: 4,
      valorGanho: 37800,
      ticketMedio: 9450,
    })
    expect(m.find((x) => x.chave === 'ticket')!.nota).toBe('média de 4 vendas')
  })

  it('o ciclo SEMPRE carrega a ressalva de que e aproximado', () => {
    // `stage_changed_at` é a última troca de etapa, não a data de fechamento.
    // Chamar isso de "tempo médio de fechamento" sem ressalva venderia
    // precisão que a coluna não tem.
    const m = medidasDeDesempenho({
      ...NADA,
      negociosGanhos: 3,
      negociosPerdidos: 1,
      diasAteFechar: 29.7,
      ticketMedio: 5000,
      valorGanho: 15000,
    })
    const ciclo = m.find((x) => x.chave === 'ciclo')!
    expect(ciclo.valor).toBe(30)
    expect(ciclo.nota).toMatch(/aproximado/)
  })

  it('ganho com valor ZERO ainda aparece, porque a base e a CONTAGEM', () => {
    // Aqui o zero é informação de verdade: fechou e não entrou dinheiro. O que
    // decide mostrar é ter havido negócio, não o valor dele.
    const m = medidasDeDesempenho({ ...NADA, negociosGanhos: 2, valorGanho: 0 })
    const ganho = m.find((x) => x.chave === 'ganho')!
    expect(ganho.valor).toBe(0)
    expect(ganho.nota).toBe('2 negócios')
  })

  it('perdido nao aparece quando nao houve perda', () => {
    const m = medidasDeDesempenho({ ...NADA, negociosGanhos: 1, valorGanho: 500 })
    expect(chaves({ ...NADA, negociosGanhos: 1, valorGanho: 500 })).not.toContain(
      'perdido',
    )
    expect(m.map((x) => x.chave)).toContain('ganho')
  })

  it('singular e plural na base', () => {
    const m = medidasDeDesempenho({ ...NADA, negociosPerdidos: 1, valorPerdido: 900 })
    expect(m.find((x) => x.chave === 'perdido')!.nota).toBe('1 negócio')
  })

  it('a ordem e ticket, ciclo, ganho, perdido', () => {
    // O dinheiro que entrou vem depois das duas medidas que explicam COMO ele
    // entrou; a perda fecha a linha.
    const tudo: DesempenhoCru = {
      valorGanho: 30000,
      valorPerdido: 4000,
      negociosGanhos: 3,
      negociosPerdidos: 2,
      ticketMedio: 10000,
      diasAteFechar: 12,
    }
    expect(chaves(tudo)).toEqual(['ticket', 'ciclo', 'ganho', 'perdido'])
  })
})
