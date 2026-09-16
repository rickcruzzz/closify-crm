import { describe, expect, it } from 'vitest'

import {
  urgenciaDaProximaAcao,
  urgenciaDoParado,
  urgenciaSemProximaAcao,
} from './urgencia'

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
  // Medido em 16/09: 34 de 42 cards (81%) exibiam a linha ambar. Alerta que
  // vale para oito de cada dez cards nao ordena nada — e o proprio arquivo
  // nasceu para curar essa doenca, um degrau acima de intensidade.
  //
  // A informacao nao se perde: o card escreve "Marcar proximo passo", que e a
  // acao, em vez de "Sem proximo passo", que e a acusacao.
  it('negócio recém-criado sem próximo passo NAO pinta alerta', () => {
    expect(urgenciaSemProximaAcao(0)).toBe('neutro')
    expect(urgenciaSemProximaAcao(3)).toBe('neutro')
  })

  // Dois sinais na mesma direção: ninguém marcou o passo E ninguém mexeu.
  it('sem próximo passo E parado vira crítico', () => {
    expect(urgenciaSemProximaAcao(14)).toBe('critico')
    expect(urgenciaSemProximaAcao(60)).toBe('critico')
  })

  it('so o PARADO pinta, e a fronteira e exatamente DIAS_PARA_PARADO', () => {
    // O caso que separa os dois mundos. Um dia antes do corte o card e uma
    // afordancia calada; no dia do corte ele vira alarme, porque ai sao dois
    // sinais na mesma direcao.
    expect(urgenciaSemProximaAcao(13)).toBe('neutro')
    expect(urgenciaSemProximaAcao(14)).toBe('critico')
  })

  it('NENHUM negocio aberto sem proximo passo devolve ambar', () => {
    // Este caso substitui um que travava o contrario ("nunca devolve neutro").
    // Ambar aqui e o ruido de 81% dos cards; ele continua valendo para tarefa
    // que vence HOJE, em `urgenciaDaProximaAcao`, que e outro caminho.
    for (const dias of [0, 1, 7, 13, 14, 100]) {
      expect(urgenciaSemProximaAcao(dias)).not.toBe('atencao')
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

  it('CONTROLE: etapa aberta e PARADA continua alertando', () => {
    // Sem este caso, "calei o ruido" e "matei o alarme" seriam
    // indistinguiveis — e o segundo e uma regressao seria.
    //
    // A segunda linha deste controle exigia `atencao` para 3 dias ate 16/09.
    // Ela saiu DE PROPOSITO: era ela que garantia o ambar em 81% dos cards. O
    // caso acima, "NENHUM negocio aberto devolve ambar", e o que ficou no
    // lugar, e os dois juntos travam a decisao pelos dois lados.
    expect(urgenciaSemProximaAcao(14)).toBe('critico')
    expect(urgenciaSemProximaAcao(14, { etapaFechada: false, sabemosAData: true })).toBe(
      'critico',
    )
  })

  it('as opcoes continuam OPCIONAIS, e o padrao e o caso comum', () => {
    // Todo chamador antigo continua compilando e rodando: o que mudou foi o
    // NIVEL devolvido no caso comum, nao a assinatura.
    for (const dias of [0, 1, 7, 13]) expect(urgenciaSemProximaAcao(dias)).toBe('neutro')
    for (const dias of [14, 60, 400]) expect(urgenciaSemProximaAcao(dias)).toBe('critico')
  })
})

describe('urgenciaDoParado', () => {
  it('semanas pedem atencao, MESES pedem alarme', () => {
    // A fronteira nao e nova: `rotuloDeParado` ja troca de unidade aos 30
    // dias, e ate 16/09 a cor ignorava isso e pintava os dois de vermelho.
    expect(urgenciaDoParado(14)).toBe('atencao')
    expect(urgenciaDoParado(29)).toBe('atencao')
    expect(urgenciaDoParado(30)).toBe('critico')
    expect(urgenciaDoParado(120)).toBe('critico')
  })

  it('NUNCA devolve neutro: a linha so existe quando ja e parado', () => {
    // Controle. Se ela pudesse sair neutra, o card teria uma linha de texto
    // dizendo "parado ha 3 semanas" sem nenhum peso visual — pior que nao
    // mostrar, porque ocupa espaco e nao ordena.
    for (const dias of [14, 20, 29, 30, 60, 400]) {
      expect(urgenciaDoParado(dias)).not.toBe('neutro')
    }
  })
})
