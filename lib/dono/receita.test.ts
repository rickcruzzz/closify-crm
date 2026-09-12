import { describe, expect, it } from 'vitest'

import {
  assinaturasComPagamento,
  classificarAcesso,
  montarQuadroDeReceita,
  type EstadoDoAcesso,
  type SinaisDaEmpresa,
} from '@/lib/dono/receita'

const base: SinaisDaEmpresa = {
  interna: false,
  temProVigente: true,
  emTrial: false,
  assinaturaNoAsaas: 'sub_1',
  assinaturaVivaNoGateway: true,
  temPagamentoConfirmado: true,
}

describe('classificarAcesso', () => {
  it('pagante exige assinatura viva no gateway E dinheiro que entrou', () => {
    expect(classificarAcesso(base)).toBe('pagante')
  })

  /**
   * O caso REAL que motivou este arquivo, medido em 30/08: a empresa "rththn"
   * tem assinatura ACTIVE no Asaas e **zero pagamento confirmado**. Contá-la
   * como receita seria repetir, um nível abaixo, o mesmo erro de confundir
   * intenção com dinheiro.
   *
   * E o estado é PRÓPRIO, não "cortesia": a diferença muda o que fazer.
   * Cortesia é decisão do dono; isto é uma venda travada que dá para
   * recuperar.
   */
  it('assinatura ACTIVE sem pagamento não é receita, e tem estado próprio', () => {
    expect(classificarAcesso({ ...base, temPagamentoConfirmado: false })).toBe(
      'assinou_sem_pagar',
    )
  })

  /**
   * O defeito principal: 10 empresas em trial gratuito apareciam como
   * R$ 490,00/mês. `pro_vigente()` é `assinatura viva OU trial válido` — ela
   * responde "pode usar?", não "pagou?".
   */
  it('trial NÃO é receita', () => {
    expect(
      classificarAcesso({
        ...base,
        emTrial: true,
        assinaturaNoAsaas: null,
        assinaturaVivaNoGateway: false,
        temPagamentoConfirmado: false,
      }),
    ).toBe('trial')
  })

  /**
   * A própria Central tem botão de liberar Pro de brinde. Sem este estado, o
   * brinde vira R$ 49/mês de "receita" — o sistema cobrando de si mesmo.
   */
  it('Pro sem trial e sem assinatura no gateway é cortesia', () => {
    expect(
      classificarAcesso({
        ...base,
        assinaturaNoAsaas: null,
        assinaturaVivaNoGateway: false,
        temPagamentoConfirmado: false,
      }),
    ).toBe('cortesia')
  })

  /**
   * O caso "Empresa de Teste": `subscriptions.status = active` no banco, e
   * NENHUMA assinatura correspondente no Asaas. O banco sabe o que o webhook
   * gravou; o gateway sabe o que aconteceu com o dinheiro.
   */
  it('assinatura marcada no banco mas morta no gateway não é pagante', () => {
    expect(classificarAcesso({ ...base, assinaturaVivaNoGateway: false })).toBe('cortesia')
  })

  /**
   * Interna vem ANTES de tudo. Classificar depois faria a conta de
   * demonstração — que tem Pro e trial até outubro — aparecer como cliente,
   * que é a outra metade do defeito de 30/08.
   */
  it('conta interna nunca é cliente, mesmo pagando de verdade', () => {
    expect(classificarAcesso({ ...base, interna: true })).toBe('interna')
  })

  it('sem Pro vigente é sem_pro, seja qual for o resto', () => {
    expect(classificarAcesso({ ...base, temProVigente: false })).toBe('sem_pro')
  })

  // Trial e cortesia ao mesmo tempo conta como trial: é o trial que explica o
  // acesso hoje, e ele tem prazo — a informação acionável é o prazo.
  it('trial vence cortesia quando os dois valem', () => {
    expect(
      classificarAcesso({
        ...base,
        emTrial: true,
        assinaturaNoAsaas: null,
        assinaturaVivaNoGateway: false,
        temPagamentoConfirmado: false,
      }),
    ).toBe('trial')
  })
})

describe('montarQuadroDeReceita', () => {
  /**
   * Este é o caso medido em produção em 30/08, com os números reais:
   * 12 empresas com `pro_vigente()`, e R$ 0,00 de receita.
   */
  it('reproduz o estado real de 30/08: acesso para 12, receita zero', () => {
    const estados: EstadoDoAcesso[] = [
      'interna',
      'interna',
      'trial',
      'trial',
      'trial',
      'trial',
      'trial',
      'trial',
      'trial',
      'trial',
      'assinou_sem_pagar',
      'cortesia',
    ]

    const quadro = montarQuadroDeReceita(estados, 49)

    expect(quadro.entraPorMes).toBe(0)
    expect(quadro.pagantes).toBe(0)
    expect(quadro.emTrial).toBe(8)
    expect(quadro.internas).toBe(2)
    expect(quadro.assinaramSemPagar).toBe(1)
    expect(quadro.cortesias).toBe(1)
  })

  it('conta só os pagantes como dinheiro', () => {
    const quadro = montarQuadroDeReceita(['pagante', 'pagante', 'trial', 'cortesia'], 49)

    expect(quadro.entraPorMes).toBe(98)
    expect(quadro.pagantes).toBe(2)
  })

  // Devolver os outros grupos é o que impede a tela de esconder que há 10
  // empresas em trial — o número que decide quanto PODE virar receita.
  it('devolve todos os grupos, não só o que dá dinheiro', () => {
    const quadro = montarQuadroDeReceita(['trial', 'cortesia', 'assinou_sem_pagar'], 49)

    expect(quadro.entraPorMes).toBe(0)
    expect(quadro.emTrial + quadro.cortesias + quadro.assinaramSemPagar).toBe(3)
  })
})

describe('assinaturasComPagamento', () => {
  it('assinatura sem NENHUMA cobrança paga não conta', () => {
    // O caso real de 12/09: duas assinaturas `ACTIVE` no Asaas, ambas só com
    // cobrança OVERDUE. O vigia anunciava "2 ativas sem Pro liberado" e a
    // resposta certa era ZERO.
    const vivas = [{ id: 'sub_a' }, { id: 'sub_b' }]
    expect(assinaturasComPagamento(vivas, [])).toEqual([])
  })

  it('conta a que recebeu, e só ela', () => {
    const vivas = [{ id: 'sub_a' }, { id: 'sub_b' }]
    const cobrancas = [{ subscription: 'sub_b' }]
    expect(assinaturasComPagamento(vivas, cobrancas)).toEqual([{ id: 'sub_b' }])
  })

  it('cobrança AVULSA não credita assinatura nenhuma', () => {
    // Pagamento sem `subscription` é cobrança solta. Tratá-lo como prova de
    // pagamento faria uma venda avulsa liberar Pro para quem tem assinatura
    // vencida — que é o mesmo erro, com outro disfarce.
    const vivas = [{ id: 'sub_a' }]
    expect(assinaturasComPagamento(vivas, [{ subscription: null }, {}])).toEqual([])
  })

  it('CONTROLE: a função não é "devolve sempre vazio"', () => {
    // Sem este caso, uma implementação que retornasse `[]` cegamente passaria
    // nos três acima — e o alerta mais caro do vigia ficaria mudo para sempre,
    // que é pior do que o falso positivo que estamos consertando.
    const vivas = [{ id: 'sub_a' }, { id: 'sub_b' }]
    const cobrancas = [{ subscription: 'sub_a' }, { subscription: 'sub_b' }]
    expect(assinaturasComPagamento(vivas, cobrancas)).toHaveLength(2)
  })
})
