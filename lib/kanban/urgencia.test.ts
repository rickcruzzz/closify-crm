import { describe, expect, it } from 'vitest'

import { urgenciaDaProximaAcao, urgenciaSemProximaAcao } from './urgencia'

// 18/08/2026, 15h em São Paulo (UTC-3).
const agora = new Date('2026-08-18T18:00:00.000Z')

describe('urgenciaDaProximaAcao', () => {
  // O defeito que motivou tudo: tarefa vencida e tarefa de amanhã tinham a
  // MESMA cor de alerta, e o board inteiro ficava vermelho.
  it('tarefa vencida é crítica', () => {
    expect(urgenciaDaProximaAcao('2026-08-17T12:00:00.000Z', agora)).toBe('critico')
  })

  it('tarefa de hoje ainda por vir é atenção, não crítico', () => {
    // 20h em São Paulo, cinco horas à frente do relógio.
    expect(urgenciaDaProximaAcao('2026-08-18T23:00:00.000Z', agora)).toBe('atencao')
  })

  // Mesma regra de `classificar` em buckets.ts: compara instante, não dia.
  // Tarefa das 9h com 15h no relógio já furou o compromisso.
  it('tarefa de hoje que já passou da hora é crítica', () => {
    expect(urgenciaDaProximaAcao('2026-08-18T12:00:00.000Z', agora)).toBe('critico')
  })

  it('tarefa futura é neutra: o card não precisa gritar', () => {
    expect(urgenciaDaProximaAcao('2026-08-25T12:00:00.000Z', agora)).toBe('neutro')
  })

  // O servidor da Vercel roda em UTC. Às 21h de São Paulo já é o dia seguinte
  // lá, e comparar sem fuso mandaria uma tarefa de hoje à noite para "neutro".
  it('usa o dia de São Paulo, não o do servidor', () => {
    // 23h30 de 18/08 em São Paulo = 02h30 de 19/08 em UTC.
    const noite = new Date('2026-08-19T02:00:00.000Z')
    // Tarefa marcada para 23h50 do mesmo dia em São Paulo.
    expect(urgenciaDaProximaAcao('2026-08-19T02:50:00.000Z', noite)).toBe('atencao')
  })
})

describe('urgenciaSemProximaAcao', () => {
  // Nunca neutro: negócio sem próximo passo é o que morre calado no funil.
  it('negócio recém-criado sem próximo passo pede atenção, não pânico', () => {
    expect(urgenciaSemProximaAcao(0)).toBe('atencao')
    expect(urgenciaSemProximaAcao(3)).toBe('atencao')
  })

  // Dois sinais na mesma direção: ninguém marcou o passo E ninguém mexeu.
  it('sem próximo passo E parado vira crítico', () => {
    expect(urgenciaSemProximaAcao(14)).toBe('critico')
    expect(urgenciaSemProximaAcao(60)).toBe('critico')
  })

  it('nunca devolve neutro', () => {
    for (const dias of [0, 1, 7, 13, 14, 100]) {
      expect(urgenciaSemProximaAcao(dias)).not.toBe('neutro')
    }
  })
})

describe('urgenciaSemProximaAcao: os dois casos que apagavam alarme falso', () => {
  it('etapa FECHADA nunca pinta urgencia, nem com 400 dias', () => {
    // `estadoDeMovimento` guarda `dias` mesmo em etapa fechada, de proposito, e
    // o card repassava o numero cru: um negocio GANHO ha 400 dias exibia alerta
    // vermelho pedindo o proximo passo. As fechadas sao "as que mais acumulam
    // linha", entao o alarme falso aparecia onde ha mais cards.
    expect(urgenciaSemProximaAcao(400, { etapaFechada: true })).toBe('neutro')
    expect(urgenciaSemProximaAcao(0, { etapaFechada: true })).toBe('neutro')
  })

  it('sem a data ainda, e neutro e nao ambar', () => {
    // O relogio nasce `null` no servidor. Assumir zero pintava todo card de
    // ambar e virava vermelho na hidratacao: piscada de cor no board inteiro.
    expect(urgenciaSemProximaAcao(0, { sabemosAData: false })).toBe('neutro')
    expect(urgenciaSemProximaAcao(30, { sabemosAData: false })).toBe('neutro')
  })

  it('CONTROLE: etapa aberta com a data continua alertando', () => {
    // Sem estes dois, "consertei o alarme" e "matei o alarme" seriam
    // indistinguiveis.
    expect(urgenciaSemProximaAcao(14)).toBe('critico')
    expect(urgenciaSemProximaAcao(3)).toBe('atencao')
    expect(urgenciaSemProximaAcao(14, { etapaFechada: false, sabemosAData: true })).toBe('critico')
  })

  it('o padrao sem opcoes nao mudou', () => {
    // Todo chamador antigo continua valendo: as opcoes sao opcionais e os
    // padroes reproduzem o comportamento anterior.
    for (const dias of [0, 1, 7, 13]) expect(urgenciaSemProximaAcao(dias)).toBe('atencao')
    for (const dias of [14, 60, 400]) expect(urgenciaSemProximaAcao(dias)).toBe('critico')
  })
})
