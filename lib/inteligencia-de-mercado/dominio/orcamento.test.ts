import { describe, expect, it } from 'vitest'

import {
  centavosDe,
  deveReenriquecer,
  podeConsultar,
  DIAS_ATE_REENRIQUECER,
  TETO_MENSAL_CENTAVOS,
} from './orcamento'

const AGORA = new Date('2026-09-06T12:00:00Z')
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000)

describe('podeConsultar', () => {
  it('para no teto, e diz por quê', () => {
    // PARAR e não degradar: "continuar com menos resultados" gasta e entrega
    // pior. Parar é visível e tem causa nomeada — o oposto do webhook do Asaas
    // que ficou interrompido dias sem ninguém saber.
    const v = podeConsultar({ gastoNoMesCentavos: TETO_MENSAL_CENTAVOS })
    expect(v.pode).toBe(false)
    if (!v.pode) {
      expect(v.motivo).toBe('teto_estourado')
      expect(v.tetoCentavos).toBe(TETO_MENSAL_CENTAVOS)
    }
  })

  it('libera abaixo do teto', () => {
    expect(podeConsultar({ gastoNoMesCentavos: TETO_MENSAL_CENTAVOS - 1 }).pode).toBe(true)
  })
})

describe('deveReenriquecer', () => {
  it('nunca consultado sempre pode', () => {
    expect(deveReenriquecer({ consultadoEm: null }, AGORA)).toBe(true)
  })

  it('recusa dentro da janela de 30 dias', () => {
    // Sinal de mercado não muda de semana em semana; o custo de reperguntar é
    // imediato e o ganho é raro.
    expect(deveReenriquecer({ consultadoEm: diasAtras(29) }, AGORA)).toBe(false)
    expect(deveReenriquecer({ consultadoEm: diasAtras(DIAS_ATE_REENRIQUECER) }, AGORA)).toBe(true)
  })

  it('mudança de ETAPA fura a janela', () => {
    // Quem entrou em "Proposta" mudou de contexto, e a resposta de 3 dias atrás
    // já não serve para a conversa de agora.
    expect(
      deveReenriquecer({ consultadoEm: diasAtras(3), etapaMudouEm: diasAtras(1) }, AGORA),
    ).toBe(true)
  })

  it('etapa que mudou ANTES da consulta não fura nada', () => {
    // Sem comparar as duas datas, qualquer negócio com etapa já registrada
    // reconsultaria a cada passagem do cron — e o teto seria só uma questão de
    // tempo.
    expect(
      deveReenriquecer({ consultadoEm: diasAtras(1), etapaMudouEm: diasAtras(9) }, AGORA),
    ).toBe(false)
  })
})

describe('centavosDe', () => {
  it('converte o costDollars do Exa arredondando para CIMA', () => {
    // US$ 0,007 medido em 06/09/2026 na resposta real. Arredondar para baixo
    // deixaria o gasto contado menor que o real, e o teto viraria enfeite.
    expect(centavosDe(0.007, 5.4)).toBe(4)
  })

  it('trata lixo como zero em vez de NaN', () => {
    // `NaN` no acumulador envenena toda comparação seguinte: `NaN >= teto` é
    // falso, então o teto pararia de funcionar em silêncio.
    expect(centavosDe(Number.NaN, 5.4)).toBe(0)
    expect(centavosDe(-1, 5.4)).toBe(0)
  })
})
