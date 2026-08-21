import { describe, expect, it } from 'vitest'

import { diasParaProximoTier, tierDaConexao } from './aquecimento'

const AGORA = new Date('2026-08-21T12:00:00Z')
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000)

/**
 * Estes limites são a segunda camada de proteção mais eficaz contra banimento
 * (a primeira é o proxy residencial). Um teto errado aqui não quebra a tela —
 * custa o telefone comercial de um cliente, sem recurso. Daí o teste.
 */
describe('tierDaConexao', () => {
  it('número recém-conectado começa no tier mais restrito', () => {
    const tier = tierDaConexao(AGORA, AGORA)
    expect(tier.rotulo).toBe('Aquecendo')
    expect(tier.porHora).toBe(10)
    expect(tier.porDia).toBe(30)
  })

  it('sobe de degrau depois de uma semana', () => {
    expect(tierDaConexao(diasAtras(7), AGORA).rotulo).toBe('Aquecendo')
    expect(tierDaConexao(diasAtras(8), AGORA).rotulo).toBe('Ganhando confiança')
  })

  it('chega ao topo depois de três semanas', () => {
    expect(tierDaConexao(diasAtras(21), AGORA).rotulo).toBe('Ganhando confiança')
    expect(tierDaConexao(diasAtras(22), AGORA).rotulo).toBe('Maduro')
    expect(tierDaConexao(diasAtras(365), AGORA).rotulo).toBe('Maduro')
  })

  // A referência de mercado: abaixo de 30/hora é seguro, acima de 60 o risco
  // cresce muito. Nenhum tier pode encostar nisso.
  it('nenhum tier passa de 30 mensagens por hora', () => {
    for (const dias of [0, 5, 10, 20, 30, 200]) {
      expect(tierDaConexao(diasAtras(dias), AGORA).porHora).toBeLessThanOrEqual(30)
    }
  })

  it('os limites só sobem, nunca descem, com o tempo', () => {
    let anterior = 0
    for (const dias of [0, 7, 8, 21, 22, 100]) {
      const atual = tierDaConexao(diasAtras(dias), AGORA).porDia
      expect(atual).toBeGreaterThanOrEqual(anterior)
      anterior = atual
    }
  })

  // Relógio torto ou dado corrompido não pode liberar envio: na dúvida, o
  // comportamento seguro é o mais restrito.
  it('data no futuro cai no tier mais restrito', () => {
    const futuro = new Date(AGORA.getTime() + 10 * 24 * 60 * 60 * 1000)
    expect(tierDaConexao(futuro, AGORA).rotulo).toBe('Aquecendo')
  })
})

describe('diasParaProximoTier', () => {
  it('conta os dias que faltam para o próximo degrau', () => {
    expect(diasParaProximoTier(AGORA, AGORA)).toBe(8)
    expect(diasParaProximoTier(diasAtras(7), AGORA)).toBe(1)
    expect(diasParaProximoTier(diasAtras(8), AGORA)).toBe(14)
  })

  it('devolve nulo quando já está no topo', () => {
    expect(diasParaProximoTier(diasAtras(22), AGORA)).toBeNull()
    expect(diasParaProximoTier(diasAtras(500), AGORA)).toBeNull()
  })
})
