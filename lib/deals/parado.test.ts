import { describe, expect, it } from 'vitest'

import {
  DIAS_PARA_PARADO,
  diasSemAndar,
  estadoDeMovimento,
  etapaFechada,
  rotuloDeParado,
} from './parado'

const agora = new Date('2026-08-12T18:00:00.000Z')

/** Data ISO de N dias antes do relógio dos testes. */
const diasAtras = (n: number) =>
  new Date(agora.getTime() - n * 86_400_000).toISOString()

describe('diasSemAndar', () => {
  it('conta dias inteiros', () => {
    expect(diasSemAndar(diasAtras(0), agora)).toBe(0)
    expect(diasSemAndar(diasAtras(1), agora)).toBe(1)
    expect(diasSemAndar(diasAtras(30), agora)).toBe(30)
  })

  // Dividir a diferença por 24h diria "0" para um card movido ontem à noite,
  // e o negócio pareceria recém-mexido. A pessoa conta em dias de calendário.
  it('card movido ontem à noite conta 1 dia, não 0', () => {
    const ontemTarde = new Date('2026-08-11T23:30:00.000Z').toISOString()
    const hojeCedo = new Date('2026-08-12T08:00:00.000Z')

    expect(diasSemAndar(ontemTarde, hojeCedo)).toBe(1)
  })

  it('nunca devolve negativo, mesmo com data no futuro', () => {
    expect(diasSemAndar(diasAtras(-5), agora)).toBe(0)
  })

  it('data ilegível não quebra a tela', () => {
    expect(diasSemAndar('não é data', agora)).toBe(0)
  })
})

describe('etapaFechada', () => {
  it('só ganho e perdido são fechadas', () => {
    expect(etapaFechada('fechado_ganho')).toBe(true)
    expect(etapaFechada('fechado_perdido')).toBe(true)
    expect(etapaFechada('novo')).toBe(false)
    expect(etapaFechada('negociacao')).toBe(false)
    expect(etapaFechada('proposta_enviada')).toBe(false)
  })
})

describe('estadoDeMovimento', () => {
  it('negócio aberto vira parado no dia do limite', () => {
    const vespera = estadoDeMovimento(
      { stage: 'negociacao', stage_changed_at: diasAtras(DIAS_PARA_PARADO - 1) },
      agora,
    )
    expect(vespera.parado).toBe(false)

    const noLimite = estadoDeMovimento(
      { stage: 'negociacao', stage_changed_at: diasAtras(DIAS_PARA_PARADO) },
      agora,
    )
    expect(noLimite.parado).toBe(true)
    expect(noLimite.dias).toBe(DIAS_PARA_PARADO)
  })

  // O recorte que impede o aviso de virar ruído: sem ele, TODO negócio ganho
  // apareceria parado há meses, e as etapas fechadas são as que mais acumulam
  // linha. A pessoa aprenderia a ignorar o sinal.
  it('negócio fechado nunca está parado, por mais antigo que seja', () => {
    for (const stage of ['fechado_ganho', 'fechado_perdido'] as const) {
      const estado = estadoDeMovimento(
        { stage, stage_changed_at: diasAtras(400) },
        agora,
      )
      expect(estado.parado).toBe(false)
      // Os dias continuam contados: o painel de detalhe ainda mostra há quanto
      // tempo o negócio foi fechado.
      expect(estado.dias).toBe(400)
    }
  })

  it('negócio movido hoje não está parado', () => {
    expect(
      estadoDeMovimento({ stage: 'novo', stage_changed_at: diasAtras(0) }, agora).parado,
    ).toBe(false)
  })
})

describe('rotuloDeParado', () => {
  it('troca a unidade conforme o número cresce', () => {
    expect(rotuloDeParado(3)).toBe('parado há 3 dias')
    expect(rotuloDeParado(13)).toBe('parado há 13 dias')
    expect(rotuloDeParado(14)).toBe('parado há 2 semanas')
    expect(rotuloDeParado(21)).toBe('parado há 3 semanas')
    expect(rotuloDeParado(60)).toBe('parado há 2 meses')
  })

  it('singular no mês', () => {
    expect(rotuloDeParado(35)).toBe('parado há 1 mês')
  })
})
