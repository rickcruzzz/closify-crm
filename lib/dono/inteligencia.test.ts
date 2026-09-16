import { describe, expect, it } from 'vitest'

import {
  MINIMO_PARA_TAXA,
  contarTemperaturas,
  ganchoDa,
  medianaDeResposta,
  montarFunilDaProspeccao,
  porFaixaDePontos,
  rankingDeGanchos,
  rankingDeNichos,
  rankingDeObjecoes,
  type InteracaoObservada,
  type ProspectObservado,
} from '@/lib/dono/inteligencia'

const base: ProspectObservado = {
  dominio: 'x.com.br',
  vertical: 'marcenaria',
  pontos: 12,
  estagio: 'CONTACTED',
  intencao: null,
  objecao: null,
  temperatura: null,
  enviadoEm: '2026-09-10T12:00:00Z',
  respondidoEm: null,
  mensagensRecebidas: 0,
  precisaHumano: false,
  temAutomacao: false,
  mensagemEnviada: null,
}

const prospect = (over: Partial<ProspectObservado>): ProspectObservado => ({
  ...base,
  ...over,
  dominio: over.dominio ?? `${Math.random()}.com.br`,
})

describe('funil da prospecção', () => {
  it('cada degrau é taxa sobre o ANTERIOR, não sobre o topo', () => {
    const funil = montarFunilDaProspeccao({
      descobertos: 100,
      prospects: [
        ...Array.from({ length: 40 }, () => prospect({})),
        ...Array.from({ length: 4 }, () =>
          prospect({ estagio: 'REPLIED', respondidoEm: '2026-09-10T14:00:00Z' }),
        ),
      ],
    })
    expect(funil.map((d) => d.quantidade)).toEqual([100, 44, 4, 0, 0])
    // 44 abordados sobre 100 descobertos
    expect(funil[1].taxa).toBeCloseTo(0.44)
    // 4 respostas sobre 44 abordados — e NÃO sobre 100
    expect(funil[2].taxa).toBeCloseTo(4 / 44)
  })

  /**
   * A ausência é a informação. O desenho pedido ia até "pagaram", e ele não
   * vai porque não existe ligação entre prospect e cliente pagante — achado
   * ALTO nº 4 da auditoria, ainda aberto.
   *
   * Desenhar `Pagaram: 0` seria pior que omitir: lê-se "ninguém chega lá",
   * quando a verdade é "não há como saber". As duas pedem ações opostas.
   */
  it('NÃO inventa os degraus de checkout e pagamento', () => {
    const funil = montarFunilDaProspeccao({ descobertos: 10, prospects: [] })
    const rotulos = funil.map((d) => d.rotulo)
    expect(rotulos).not.toContain('Checkout')
    expect(rotulos).not.toContain('Pagaram')
  })

  it('não divide por zero', () => {
    const funil = montarFunilDaProspeccao({ descobertos: 0, prospects: [] })
    expect(funil.every((d) => d.taxa === null || Number.isFinite(d.taxa))).toBe(true)
    expect(funil[1].taxa).toBeNull()
  })

  it('quem pediu para sair CONTA como resposta', () => {
    // "Não quero" é resposta: ele diz que a mensagem chegou e foi lida. Tirar
    // do degrau faria a taxa de resposta parecer menor do que é.
    const funil = montarFunilDaProspeccao({
      descobertos: 1,
      prospects: [prospect({ estagio: 'OPTED_OUT' })],
    })
    expect(funil[2].quantidade).toBe(1)
  })
})

describe('a amostra mínima, que é a regra que governa a tela', () => {
  /**
   * Cold outreach responde 3,8-7,2%. Com 30 abordagens o esperado é UMA ou
   * DUAS respostas, e a diferença entre 1 e 2 vira 3,3% contra 6,7% — o dobro,
   * por acaso. Declarar vencedor ali é ler ruído.
   */
  it('abaixo de 100 abordagens NÃO mostra taxa, e diz quantas faltam', () => {
    const nichos = rankingDeNichos(
      Array.from({ length: 30 }, () => prospect({ vertical: 'marcenaria' })),
    )
    expect(nichos[0].abordados).toBe(30)
    expect(nichos[0].taxaDeResposta).toBeNull()
    expect(nichos[0].faltamParaMedir).toBe(MINIMO_PARA_TAXA - 30)
  })

  it('a partir de 100 a taxa aparece', () => {
    const lista = [
      ...Array.from({ length: 95 }, () => prospect({ vertical: 'dedetizacao' })),
      ...Array.from({ length: 5 }, () =>
        prospect({ vertical: 'dedetizacao', estagio: 'REPLIED' }),
      ),
    ]
    const nichos = rankingDeNichos(lista)
    expect(nichos[0].abordados).toBe(100)
    expect(nichos[0].taxaDeResposta).toBeCloseTo(0.05)
    expect(nichos[0].faltamParaMedir).toBe(0)
  })

  /**
   * Ordenar por taxa poria no topo o nicho com 1 abordagem e 1 resposta —
   * 100%, e nada. A tela orienta para onde mandar as próximas mensagens, e a
   * ordem por volume mostra onde a medição tem chão.
   */
  it('ordena por VOLUME, nunca por taxa', () => {
    const nichos = rankingDeNichos([
      prospect({ vertical: 'sorte', estagio: 'INTERESTED' }),
      ...Array.from({ length: 10 }, () => prospect({ vertical: 'volume' })),
    ])
    expect(nichos[0].rotulo).toBe('volume')
  })

  it('prospect sem nicho não some, vira "sem-nicho"', () => {
    const nichos = rankingDeNichos([prospect({ vertical: null })])
    expect(nichos[0].rotulo).toBe('sem-nicho')
  })
})

describe('objeções', () => {
  const i = (objecao: InteracaoObservada['objecao']): InteracaoObservada => ({
    intencao: 'PEDIU_PRECO',
    objecao,
    temperatura: 'morno',
    confianca: 0.9,
    precisaHumano: false,
  })

  it('conta e ordena da mais comum para a mais rara', () => {
    const r = rankingDeObjecoes([i('PRECO'), i('PRECO'), i('TEMPO'), i(null)])
    expect(r[0]).toMatchObject({ objecao: 'PRECO', quantidade: 2 })
    expect(r[1]).toMatchObject({ objecao: 'TEMPO', quantidade: 1 })
  })

  /**
   * A fatia é sobre as respostas COM objeção. Dividir pelo total faria toda
   * objeção parecer rara num mês em que a maioria só perguntou preço — e a
   * pergunta desta tela é "quando aparece barreira, qual é?".
   */
  it('a fatia ignora quem não trouxe objeção nenhuma', () => {
    const r = rankingDeObjecoes([i('PRECO'), i(null), i(null), i(null)])
    expect(r[0].fatia).toBe(1)
  })

  it('sem objeção nenhuma devolve lista vazia, não uma linha zerada', () => {
    expect(rankingDeObjecoes([i(null), i(null)])).toEqual([])
  })
})

describe('gancho', () => {
  const MENSAGEM = [
    'Oi! Achei a Marcenaria Silva aqui em Salvador.',
    'Quando voce manda um orcamento e o cliente some, quem lembra de dar o retorno?',
    'Fiz um sistema pra isso.',
  ].join('\n')

  it('é a SEGUNDA linha da mensagem que saiu', () => {
    expect(ganchoDa(MENSAGEM)).toMatch(/quem lembra de dar o retorno/)
  })

  it('mensagem ausente não vira gancho vazio', () => {
    expect(ganchoDa(null)).toBeNull()
    expect(ganchoDa('')).toBeNull()
    expect(ganchoDa('so uma linha')).toBeNull()
  })

  it('prospect sem mensagem gravada fica FORA do ranking', () => {
    // Os 98 sincronizados têm o texto; um disparo futuro que falhe ao registrar
    // não pode virar um gancho chamado "null" competindo com os reais.
    const r = rankingDeGanchos([prospect({ mensagemEnviada: null }), prospect({ mensagemEnviada: MENSAGEM })])
    expect(r).toHaveLength(1)
  })
})

describe('faixas de pontos', () => {
  it('cobre toda a escala sem buraco nem sobreposição', () => {
    const faixas = porFaixaDePontos([])
    for (let i = 1; i < faixas.length; i++) {
      expect(faixas[i].de).toBe(faixas[i - 1].ate + 1)
    }
  })

  it('põe cada prospect em uma faixa só', () => {
    const faixas = porFaixaDePontos([
      prospect({ pontos: 9 }),
      prospect({ pontos: 10 }),
      prospect({ pontos: 13 }),
      prospect({ pontos: 17 }),
    ])
    expect(faixas.map((f) => f.abordados)).toEqual([1, 1, 1, 1])
  })

  it('pontos nulos caem na faixa mais baixa em vez de sumir', () => {
    const faixas = porFaixaDePontos([prospect({ pontos: null })])
    expect(faixas[0].abordados).toBe(1)
  })
})

describe('temperatura e tempo', () => {
  it('conta as cinco, inclusive as zeradas', () => {
    const t = contarTemperaturas([prospect({ temperatura: 'quente' })])
    expect(t).toEqual({ frio: 0, morno: 0, quente: 1, muito_quente: 0, fechamento: 0 })
  })

  /**
   * Mediana e não média: uma resposta que chega duas semanas depois puxa a
   * média para um número que não descreve ninguém.
   */
  it('mediana ignora o caso extremo que a média não ignoraria', () => {
    const h = (horas: number) =>
      prospect({
        enviadoEm: '2026-09-10T00:00:00Z',
        respondidoEm: new Date(Date.parse('2026-09-10T00:00:00Z') + horas * 3_600_000).toISOString(),
      })
    const mediana = medianaDeResposta([h(1), h(2), h(3), h(400)])
    expect(mediana).toBeCloseTo(2.5)
  })

  it('sem resposta nenhuma devolve null, não zero', () => {
    // Zero diria "todo mundo respondeu na hora". Null diz "ainda não sei".
    expect(medianaDeResposta([prospect({})])).toBeNull()
  })
})
