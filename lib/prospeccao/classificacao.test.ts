import { describe, expect, it } from 'vitest'

import {
  ESTAGIOS,
  INTENCOES,
  OBJECOES,
  TEMPERATURAS,
  ehIntencao,
  ehObjecao,
  ehTemperatura,
  estagioDaIntencao,
  objetivoDa,
  precisaDeHumano,
  proximoEstagio,
  temperaturaFinal,
} from '@/lib/prospeccao/classificacao'

describe('as listas são fechadas', () => {
  /**
   * O `check` da 0086 repete estas listas em SQL. Se uma crescer aqui e não
   * lá, a linha é recusada pelo banco em produção — e o sintoma seria a
   * classificação sumindo em silêncio.
   */
  it('não têm duplicata', () => {
    for (const lista of [INTENCOES, OBJECOES, TEMPERATURAS, ESTAGIOS]) {
      expect(new Set(lista).size).toBe(lista.length)
    }
  })

  it('recusam o que está fora', () => {
    expect(ehIntencao('PEDIU_PRECO')).toBe(true)
    expect(ehIntencao('pediu_preco')).toBe(false)
    expect(ehIntencao('MUITO_INTERESSADO')).toBe(false)
    expect(ehObjecao('PRECO')).toBe(true)
    expect(ehObjecao('CARO_DEMAIS')).toBe(false)
    expect(ehTemperatura('quente')).toBe(true)
    expect(ehTemperatura('morninho')).toBe(false)
  })
})

describe('temperatura: o modelo propõe, o teto decide', () => {
  /**
   * A regra que este teto existe para impedir, dita no pedido: *"não deixar a
   * IA transformar qualquer 'quanto custa?' automaticamente em fechamento"*.
   * Perguntar preço é curiosidade com frequência, e tratar como fechamento
   * manda o dono cobrar decisão de quem só perguntou.
   */
  it('"quanto custa?" NUNCA vira fechamento, mesmo com confiança 1', () => {
    expect(temperaturaFinal('PEDIU_PRECO', 'fechamento', 1)).toBe('quente')
    expect(temperaturaFinal('PEDIU_PRECO', 'muito_quente', 1)).toBe('quente')
  })

  it('o teto nunca SOBE o que o modelo propôs', () => {
    // Se o modelo leu frieza numa resposta de interesse alto, ele viu algo que
    // o mapa não vê. Baixar é recuperável; subir cria trabalho sobre nada.
    expect(temperaturaFinal('INTERESSE_ALTO', 'frio', 0.95)).toBe('frio')
    expect(temperaturaFinal('QUER_DEMO', 'morno', 0.9)).toBe('morno')
  })

  /** `fechamento` é o único degrau em que a confiança muda o resultado. */
  it('fechamento exige INTERESSE_ALTO e confiança >= 0,9', () => {
    expect(temperaturaFinal('INTERESSE_ALTO', 'fechamento', 0.95)).toBe('fechamento')
    expect(temperaturaFinal('INTERESSE_ALTO', 'fechamento', 0.89)).toBe('muito_quente')
    expect(temperaturaFinal('INTERESSE_ALTO', 'fechamento', null)).toBe('muito_quente')
  })

  it('quem disse não fica frio, proponha o modelo o que propuser', () => {
    for (const i of ['SEM_INTERESSE', 'OPT_OUT', 'SPAM', 'INCONCLUSIVO'] as const) {
      expect(temperaturaFinal(i, 'fechamento', 1)).toBe('frio')
    }
  })

  it('objeção é morno, nunca mais que isso', () => {
    expect(temperaturaFinal('OBJECAO_PRECO', 'muito_quente', 0.9)).toBe('morno')
    expect(temperaturaFinal('OBJECAO_JA_TENHO_SOLUCAO', 'quente', 0.9)).toBe('morno')
  })
})

describe('estágio', () => {
  it('toda intenção tem um estágio, e ele está na lista', () => {
    for (const i of INTENCOES) {
      expect(ESTAGIOS).toContain(estagioDaIntencao(i))
    }
  })

  /**
   * `CHECKOUT_SENT`, `PAYMENT_PENDING` e `CONVERTED` ficaram fora da lista
   * porque nada os escreve. Este caso trava a ausência: declará-los faria o
   * painel mostrar um degrau que sempre vale zero, e a leitura seria "ninguém
   * chega lá" quando a verdade é que não há como chegar.
   */
  it('não existe estágio de checkout nesta fase', () => {
    expect(ESTAGIOS).not.toContain('CHECKOUT_SENT')
    expect(ESTAGIOS).not.toContain('CONVERTED')
  })

  it('quem pede para sair cai em OPTED_OUT, e quem recusa em LOST', () => {
    expect(estagioDaIntencao('OPT_OUT')).toBe('OPTED_OUT')
    expect(estagioDaIntencao('SEM_INTERESSE')).toBe('LOST')
  })

  it('"já uso outro CRM" é OBJEÇÃO, não perda', () => {
    // É a diferença entre desistir e ter o que responder: o argumento do
    // produto é justamente que nenhum concorrente AVISA antes de vencer.
    expect(estagioDaIntencao('JA_USA_CRM')).toBe('OBJECTION')
    expect(estagioDaIntencao('OBJECAO_JA_TENHO_SOLUCAO')).toBe('OBJECTION')
  })

  it('quem não decide vai para humano', () => {
    expect(estagioDaIntencao('NAO_E_RESPONSAVEL')).toBe('HUMAN_HANDOFF')
    expect(estagioDaIntencao('PEDIU_OUTRO_CONTATO')).toBe('HUMAN_HANDOFF')
  })
})

describe('quando a IA cala e chama gente', () => {
  it.each([
    ['vou falar com meu advogado', 'jurídico'],
    ['isso é golpe, vou no Procon', 'procon'],
    ['que absurdo, para de me mandar isso', 'irritação'],
    ['me liga que eu explico', 'pedido de ligação'],
    ['tem desconto especial pra mim?', 'fora de política'],
  ])('"%s" vai para humano (%s)', (texto) => {
    expect(precisaDeHumano('PEDIU_DETALHES', texto, 0.95).precisa).toBe(true)
  })

  it('confiança baixa vira fila humana, e o motivo diz o número', () => {
    const r = precisaDeHumano('PEDIU_PRECO', 'hmm', 0.4)
    expect(r.precisa).toBe(true)
    expect(r.motivo).toContain('0.40')
  })

  it('INCONCLUSIVO chama gente mesmo com confiança alta', () => {
    // O modelo disse que NÃO entendeu. Insistir transformaria "não sei" em
    // decisão, que é o pior resultado possível para a estatística.
    expect(precisaDeHumano('INCONCLUSIVO', 'kkk', 0.99).precisa).toBe(true)
  })

  /**
   * A exceção que mais importa. `OPT_OUT` já tem tratamento automático —
   * registra e cala. Mandar para a fila humana faria alguém abrir conversa com
   * quem acabou de pedir para não ser procurado.
   */
  it('OPT_OUT NUNCA chama humano, nem com confiança baixa', () => {
    expect(precisaDeHumano('OPT_OUT', 'não quero, me tira da lista', 0.2).precisa).toBe(false)
    expect(precisaDeHumano('OPT_OUT', 'vou no procon se mandar de novo', 0.2).precisa).toBe(false)
  })

  it('resposta comum com confiança alta segue automática', () => {
    expect(precisaDeHumano('PEDIU_PRECO', 'quanto custa?', 0.92).precisa).toBe(false)
  })

  it('acento não muda a decisão', () => {
    expect(precisaDeHumano('PEDIU_DETALHES', 'vou na justiça', 0.9).precisa).toBe(true)
    expect(precisaDeHumano('PEDIU_DETALHES', 'vou na justica', 0.9).precisa).toBe(true)
  })
})

describe('objetivo da interação', () => {
  it('toda intenção tem um objetivo, e nenhum é vazio', () => {
    for (const i of INTENCOES) {
      expect(objetivoDa(i).length).toBeGreaterThan(3)
    }
  })

  /** Quem pediu para sair não recebe estratégia de convencimento. */
  it('OPT_OUT não tem objetivo de venda', () => {
    expect(objetivoDa('OPT_OUT')).toMatch(/não responder/i)
  })
})

describe('o estágio anda para a frente, e OPTED_OUT não volta', () => {
  /**
   * ## O defeito que estes casos travam, medido em 12/09
   *
   * A regra vivia em `classificar-pendentes.ts` e ordenava SETE estágios,
   * deixando `OPTED_OUT` e `LOST` fora da lista. `indexOf` devolve **-1** para
   * quem não está nela, então qualquer estágio comum ficava "maior" que
   * `OPTED_OUT` e a comparação passava.
   *
   * Na prática: a pessoa respondia "não quero receber mais", o estágio virava
   * `OPTED_OUT`, e a MENSAGEM SEGUINTE — qualquer uma — o arrastava de volta
   * para `REPLIED`. Em silêncio, porque -1 não parece erro.
   *
   * Pego pela prova de ponta a ponta, não por leitura de código.
   */
  it('quem pediu para sair NÃO volta, aconteça o que acontecer depois', () => {
    for (const depois of ESTAGIOS) {
      expect(proximoEstagio('OPTED_OUT', depois)).toBe('OPTED_OUT')
    }
  })

  it('o "não quero" manda, venha de onde vier', () => {
    expect(proximoEstagio('INTERESTED', 'OPTED_OUT')).toBe('OPTED_OUT')
    expect(proximoEstagio('CONTACTED', 'OPTED_OUT')).toBe('OPTED_OUT')
  })

  /**
   * `LOST` manda sempre — "sem interesse" é fato novo mesmo vindo de quem
   * estava interessado. Mas NÃO é terminal: um "na verdade, quanto custa?"
   * depois precisa poder avançar.
   */
  it('LOST manda sempre, e ainda assim é reversível', () => {
    expect(proximoEstagio('INTERESTED', 'LOST')).toBe('LOST')
    expect(proximoEstagio('LOST', 'QUALIFYING')).toBe('QUALIFYING')
  })

  it('não anda para trás: "ok" depois de INTERESTED não vira REPLIED', () => {
    expect(proximoEstagio('INTERESTED', 'REPLIED')).toBe('INTERESTED')
    expect(proximoEstagio('QUALIFYING', 'CONTACTED')).toBe('QUALIFYING')
  })

  it('avança quando é para avançar', () => {
    expect(proximoEstagio('CONTACTED', 'REPLIED')).toBe('REPLIED')
    expect(proximoEstagio('REPLIED', 'QUALIFYING')).toBe('QUALIFYING')
    expect(proximoEstagio('QUALIFYING', 'INTERESTED')).toBe('INTERESTED')
  })

  /**
   * Todo estágio precisa estar na ordenação, senão `indexOf` devolve -1 e a
   * comparação mente. Este caso é a sentinela: um estágio novo que alguém
   * acrescente a `ESTAGIOS` sem pôr na ordem reprova aqui.
   */
  it('TODO estágio está na ordenação', () => {
    for (const e of ESTAGIOS) {
      if (e === 'OPTED_OUT') continue
      // Partindo de CONTACTED, qualquer estágio ou avança ou fica — nunca
      // devolve algo fora da lista.
      expect(ESTAGIOS).toContain(proximoEstagio('CONTACTED', e) as never)
    }
  })

  it('estágio desconhecido no atual não trava o avanço', () => {
    // Dado velho ou de uma migration futura: sem referência, o que chegou
    // agora é a melhor informação disponível.
    expect(proximoEstagio('ESTAGIO_QUE_NAO_EXISTE', 'QUALIFYING')).toBe('QUALIFYING')
  })
})
