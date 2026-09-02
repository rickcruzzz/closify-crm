import { describe, expect, it } from 'vitest'

import {
  assuntoDoVigia,
  deveEnviar,
  leiturasQueFalharam,
  montarAlertas,
  type LeituraDoVigia,
} from './vigia'

/** Tudo lido, tudo limpo. O caso em que o vigia precisa ficar calado. */
const LIMPO: LeituraDoVigia = {
  assinaturasSemPro: 0,
  errosNovos: 0,
  trialsVencendo: 0,
  suporteParado: 0,
  cobrancasVencidas: 0,
}

describe('montarAlertas', () => {
  it('não inventa alerta quando está tudo limpo', () => {
    expect(montarAlertas(LIMPO)).toEqual([])
  })

  it('trata null como "não sei", e não como zero', () => {
    // O defeito que este caso trava é o da Central em 30/08: "não consegui
    // ler" e "não há nada" tinham virado o mesmo valor, e a tela declarava
    // R$ 490/mês de receita com R$ 0,00 real.
    const semLeitura: LeituraDoVigia = {
      assinaturasSemPro: null,
      errosNovos: null,
      trialsVencendo: null,
      suporteParado: null,
      cobrancasVencidas: null,
    }
    expect(montarAlertas(semLeitura)).toEqual([])
    expect(leiturasQueFalharam(semLeitura)).toHaveLength(5)
  })

  it('põe dinheiro antes de defeito', () => {
    // Um erro pode ser navegador antigo de alguém que nunca voltou. Uma
    // assinatura ativa sem Pro é gente que pagou e não recebeu.
    const alertas = montarAlertas({
      ...LIMPO,
      errosNovos: 9,
      assinaturasSemPro: 1,
    })
    expect(alertas[0].gravidade).toBe('dinheiro')
    expect(alertas[alertas.length - 1].gravidade).toBe('defeito')
  })

  it('põe cliente entre dinheiro e defeito', () => {
    const alertas = montarAlertas({
      ...LIMPO,
      errosNovos: 1,
      trialsVencendo: 1,
      cobrancasVencidas: 1,
    })
    expect(alertas.map((a) => a.gravidade)).toEqual(['dinheiro', 'cliente', 'defeito'])
  })

  it('aponta a tela que trata de cada alerta', () => {
    const [trial] = montarAlertas({ ...LIMPO, trialsVencendo: 3 })
    expect(trial.ondeOlhar).toBe('/dono/trial')
  })
})

describe('deveEnviar', () => {
  it('fica calado quando tudo foi lido e está limpo', () => {
    // A regra mais importante do arquivo. Um "tudo certo" diário treina a
    // pessoa a arquivar sem ler, e aí o e-mail grave chega num reflexo já
    // formado — a lição dos 8 de 11 alertas de ruído de 20/08.
    expect(deveEnviar(LIMPO)).toBe(false)
  })

  it('envia quando há qualquer alerta', () => {
    expect(deveEnviar({ ...LIMPO, errosNovos: 1 })).toBe(true)
  })

  it('envia quando uma leitura falhou, mesmo sem alerta nenhum', () => {
    // Não saber é, ele próprio, uma informação: um vigia que não conseguiu ler
    // o Asaas e cala passa a mensagem de que conferiu e estava tudo bem.
    expect(deveEnviar({ ...LIMPO, assinaturasSemPro: null })).toBe(true)
  })
})

describe('assuntoDoVigia', () => {
  it('cabe na notificação do celular e põe o número na frente', () => {
    const assunto = assuntoDoVigia(montarAlertas({ ...LIMPO, errosNovos: 2 }), [])
    expect(assunto).toBe('Velo Funil: 1 alerta')
    expect(assunto.length).toBeLessThanOrEqual(40)
  })

  it('avisa no assunto quando envolve dinheiro', () => {
    const assunto = assuntoDoVigia(
      montarAlertas({ ...LIMPO, assinaturasSemPro: 1 }),
      [],
    )
    expect(assunto).toContain('dinheiro')
  })

  it('não diz "1 alertas"', () => {
    expect(assuntoDoVigia(montarAlertas({ ...LIMPO, errosNovos: 1 }), [])).toContain(
      '1 alerta',
    )
    expect(assuntoDoVigia(montarAlertas({ ...LIMPO, errosNovos: 1 }), [])).not.toContain(
      '1 alertas',
    )
  })

  it('não afirma que está tudo bem quando não conseguiu conferir', () => {
    // O caso perigoso: zero alertas porque zero leituras funcionaram.
    const assunto = assuntoDoVigia([], ['assinaturas no Asaas'])
    expect(assunto).toContain('não consegui')
  })
})
