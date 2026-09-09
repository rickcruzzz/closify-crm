import { describe, expect, it } from 'vitest'

import {
  alertasNaoAvisados,
  assuntoDoVigia,
  chaveDoAlerta,
  memoriaAtualizada,
  quantidadeDoAlerta,
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
  credenciaisMortas: [],
  webhooksParados: [],
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
      credenciaisMortas: null,
      webhooksParados: null,
    }
    expect(montarAlertas(semLeitura)).toEqual([])
    // Derivado, e não o número 6 escrito à mão: com o número fixo, toda
    // leitura nova reprovava este caso sem nada estar errado — e o reflexo é
    // subir o número, que esvazia a asserção. O que importa é que TODA leitura
    // que falhou seja nomeada, quantas forem.
    expect(leiturasQueFalharam(semLeitura)).toHaveLength(Object.keys(semLeitura).length)
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

describe('credenciais externas', () => {
  it('avisa quando uma credencial para de responder', () => {
    // O caso que motivou: o META_ADS_TOKEN ficou tres dias marcado como morto
    // depois de voltar, e a pendencia pedia acao que nao era necessaria.
    // Nenhum tsc, lint ou test consulta a Graph API — so isto consulta.
    const [a] = montarAlertas({ ...LIMPO, credenciaisMortas: ['Meta Ads'] })
    expect(a.titulo).toContain('1 credencial')
    expect(a.detalhe).toContain('Meta Ads')
  })

  it('cala quando todas respondem', () => {
    expect(montarAlertas({ ...LIMPO, credenciaisMortas: [] })).toEqual([])
  })
})

describe('alertasNaoAvisados', () => {
  const doisErros = montarAlertas({ ...LIMPO, errosNovos: 2 })
  const trintaErros = montarAlertas({ ...LIMPO, errosNovos: 30 })

  it('manda o que nunca foi avisado', () => {
    expect(alertasNaoAvisados(doisErros, {})).toHaveLength(1)
  })

  it('cala quando o alerta continua igual', () => {
    // A razão de a memória existir: rodando de hora em hora, um erro que
    // apareceu de manhã geraria 24 e-mails idênticos até alguém resolver.
    const memoria = memoriaAtualizada(doisErros)
    expect(alertasNaoAvisados(doisErros, memoria)).toHaveLength(0)
  })

  it('manda de novo quando PIOROU', () => {
    // Dois erros podem ser um navegador antigo; trinta são defeito em
    // produção. Sem comparar o número, os dois casos calariam igual.
    const memoria = memoriaAtualizada(doisErros)
    expect(alertasNaoAvisados(trintaErros, memoria)).toHaveLength(1)
  })

  it('cala quando melhorou sem zerar', () => {
    // Quem está resolvendo não precisa ser avisado de que está funcionando.
    const memoria = memoriaAtualizada(trintaErros)
    expect(alertasNaoAvisados(doisErros, memoria)).toHaveLength(0)
  })

  it('a chave não muda quando só a quantidade muda', () => {
    // Se o número entrasse na chave, cada quantidade viraria um alerta
    // diferente e a memória nunca casaria — 2 erros e 3 erros seriam coisas
    // distintas, e todo aumento passaria como novidade.
    expect(chaveDoAlerta(doisErros[0])).toBe(chaveDoAlerta(trintaErros[0]))
  })

  it('lê a quantidade do próprio título, sem campo paralelo', () => {
    expect(quantidadeDoAlerta(trintaErros[0])).toBe(30)
  })

  /**
   * ## O alerta que VOLTA, e o silêncio de três dias que ele causou
   *
   * Medido em 09/09, na memória de produção: três chaves presas desde 06/09,
   * com o cron passando 72 vezes no meio. O webhook do Asaas quebrou de novo
   * em 08/09 e o vigia **não avisou** — a chave velha ainda dizia `1`, o
   * alerta novo também vale `1`, e só PIOROU dispara.
   *
   * A causa não era `alertasNaoAvisados`, que compara certo. Era a rota: a
   * memória só era escrita depois de um envio, e a saída "nada novo" pulava a
   * escrita. Alerta que se resolvia enquanto OUTROS seguiam vivos deixava a
   * chave para trás — a purga da rota só roda quando a fila esvazia inteira.
   *
   * O contrato que estes dois casos travam é o que a rota agora cumpre nas
   * duas saídas: a memória descreve os alertas VIVOS, e nada além deles.
   */
  it('o que saiu da fila SAI da memória', () => {
    const webhook = montarAlertas({ ...LIMPO, webhooksParados: ['Velo Funil - assinaturas'] })
    const memoriaComWebhook = memoriaAtualizada(webhook)
    expect(Object.keys(memoriaComWebhook)).toHaveLength(1)

    // O webhook foi religado, mas OUTRO alerta continua vivo. É o caso real:
    // a fila não esvaziou, então a purga de "nada a relatar" não roda.
    const memoriaDepois = memoriaAtualizada(doisErros)
    expect(Object.keys(memoriaDepois)).toEqual(
      Object.keys(memoriaAtualizada(doisErros)),
    )
    for (const chave of Object.keys(memoriaComWebhook)) {
      expect(memoriaDepois[chave]).toBeUndefined()
    }
  })

  it('e por isso o mesmo problema VOLTANDO conta como novidade', () => {
    // Sem a linha acima, este caso é o silêncio de 08/09: mesma chave, mesma
    // quantidade, `1 > 1` falso, nenhum e-mail.
    const webhook = montarAlertas({ ...LIMPO, webhooksParados: ['Velo Funil - assinaturas'] })
    const memoriaSemEle = memoriaAtualizada(doisErros)
    expect(alertasNaoAvisados(webhook, memoriaSemEle)).toHaveLength(1)

    // E o controle: se a chave TIVESSE ficado presa, ele calaria — que é
    // exatamente o defeito, reproduzido aqui para não voltar em silêncio.
    const memoriaPresa = memoriaAtualizada(webhook)
    expect(alertasNaoAvisados(webhook, memoriaPresa)).toHaveLength(0)
  })
})

/**
 * ## O alerta que existe porque o silêncio mentiu por cinco dias
 *
 * O webhook do Asaas ficou `interrupted: true` de 30/08 às 23:18 até 04/09.
 * Pagamento confirmado não chegava ao produto, e do lado de fora isso é
 * idêntico a "ninguém pagou". Foi descoberto por acaso.
 */
describe('webhook do Asaas parado', () => {
  it('vira alerta de DINHEIRO, e nomeia qual parou', () => {
    const [alerta] = montarAlertas({
      ...LIMPO,
      webhooksParados: ['Velo Funil - assinaturas'],
    })
    expect(alerta?.gravidade).toBe('dinheiro')
    expect(alerta?.titulo).toContain('Velo Funil - assinaturas')
  })

  // Um pagamento parado no caminho é pior que uma cobrança que ninguém pagou:
  // o dinheiro já saiu da conta da pessoa e ela está esperando o produto.
  it('aparece antes da cobrança vencida', () => {
    const alertas = montarAlertas({
      ...LIMPO,
      cobrancasVencidas: 3,
      webhooksParados: ['Velo Funil - assinaturas'],
    })
    expect(alertas[0]?.titulo).toContain('Webhook')
  })

  // Controle negativo: um alarme que toca com a fila sã ensina a ignorá-lo,
  // que é a lição de 20/08 com 8 dos 11 alertas sendo ruído.
  it('cala quando nenhuma fila está parada', () => {
    expect(montarAlertas({ ...LIMPO, webhooksParados: [] })).toEqual([])
  })

  it('lista vazia é diferente de null: null é "não consegui olhar"', () => {
    expect(leiturasQueFalharam({ ...LIMPO, webhooksParados: [] })).not.toContain(
      'fila do webhook do Asaas',
    )
    expect(leiturasQueFalharam({ ...LIMPO, webhooksParados: null })).toContain(
      'fila do webhook do Asaas',
    )
  })
})
