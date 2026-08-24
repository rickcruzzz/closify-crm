import { describe, expect, it } from 'vitest'

import {
  apenasDosUltimosDias,
  maiorVazamento,
  montarFunilDeAtivacao,
  type ContaObservada,
} from './ativacao'

/** Uma conta que fez tudo. Cada teste desliga só o que precisa negar. */
function conta(sobrescreve: Partial<ContaObservada> = {}): ContaObservada {
  return {
    criadaEm: '2026-08-20T12:00:00.000Z',
    concluiuOnboarding: true,
    temContato: true,
    temNegocio: true,
    conectouCanal: true,
    proVigente: true,
    ...sobrescreve,
  }
}

describe('funil de ativação', () => {
  it('base vazia não divide por zero nem inventa percentual', () => {
    const funil = montarFunilDeAtivacao([])
    expect(funil).toHaveLength(6)
    expect(funil.every((d) => d.quantas === 0 && d.percentualDoTopo === 0)).toBe(true)
  })

  // O degrau de cima é sempre 100%: todo mundo que está no funil criou conta.
  it('todo mundo passa pelo primeiro degrau', () => {
    const funil = montarFunilDeAtivacao([conta(), conta(), conta()])
    expect(funil[0].quantas).toBe(3)
    expect(funil[0].percentualDoTopo).toBe(100)
    expect(funil[0].percentualDoAnterior).toBeNull()
  })

  /**
   * O caso que motivou a contagem cumulativa. Alguém pode PULAR o assistente
   * (o produto permite) e mesmo assim cadastrar contato. Contando cada degrau
   * isolado, "primeiro contato" apareceria MAIOR que "terminou o assistente" —
   * um funil que alarga no meio, que é visivelmente absurdo e faria qualquer
   * pessoa parar de confiar no resto do número.
   */
  it('degrau nunca fica maior que o anterior, mesmo com etapa pulada', () => {
    const funil = montarFunilDeAtivacao([
      conta({ concluiuOnboarding: false, temContato: true, temNegocio: true }),
      conta(),
    ])

    expect(funil[1].quantas).toBe(1) // só uma terminou o assistente
    expect(funil[2].quantas).toBe(1) // e o contato não pode passar dela
    for (let i = 1; i < funil.length; i += 1) {
      expect(funil[i].quantas).toBeLessThanOrEqual(funil[i - 1].quantas)
    }
  })

  it('conta quem parou no meio do caminho', () => {
    const funil = montarFunilDeAtivacao([
      conta(),
      conta({ conectouCanal: false, proVigente: false }),
      conta({ temNegocio: false, conectouCanal: false, proVigente: false }),
      conta({ temContato: false, temNegocio: false, conectouCanal: false, proVigente: false }),
    ])

    expect(funil.map((d) => d.quantas)).toEqual([4, 4, 3, 2, 1, 1])
    expect(funil[2].percentualDoTopo).toBe(75)
    expect(funil[2].percentualDoAnterior).toBe(75)
  })

  // Percentual sobre o degrau anterior é o que aponta vazamento; sobre o topo,
  // o que mede o resultado final. A tela mostra os dois porque respondem
  // perguntas diferentes.
  it('separa o percentual do topo do percentual do degrau anterior', () => {
    const funil = montarFunilDeAtivacao([
      conta(),
      conta(),
      conta({ temNegocio: false, conectouCanal: false, proVigente: false }),
      conta({ temNegocio: false, conectouCanal: false, proVigente: false }),
    ])

    const negocio = funil[3]
    expect(negocio.percentualDoTopo).toBe(50) // 2 de 4 no total
    expect(negocio.percentualDoAnterior).toBe(50) // 2 de 4 que tinham contato
  })
})

describe('maior vazamento', () => {
  /**
   * A regra que evita decidir por acaso: com base minúscula, o "maior
   * vazamento" é uma pessoa desistindo, e apontar isso na tela sugeriria um
   * problema onde só existe amostra pequena.
   */
  it('não opina com base pequena demais', () => {
    const funil = montarFunilDeAtivacao([conta(), conta({ temContato: false })])
    expect(maiorVazamento(funil)).toBeNull()
  })

  it('aponta onde some mais gente, não onde o percentual é pior', () => {
    // 10 contas: 8 somem no contato (perda 8). Das 2 que sobram, 1 não paga
    // (perda 1, mas 50% — percentual pior e volume menor).
    const contas = [
      ...Array.from({ length: 8 }, () =>
        conta({ temContato: false, temNegocio: false, conectouCanal: false, proVigente: false }),
      ),
      conta(),
      conta({ proVigente: false }),
    ]

    const pior = maiorVazamento(montarFunilDeAtivacao(contas))
    expect(pior?.degrau.etapa).toBe('primeiro_contato')
    expect(pior?.perdeu).toBe(8)
  })

  /**
   * O defeito que os dados reais expuseram: `conectou_canal` estava antes de
   * `virou_pro`, e o funil passou a acusar "conectar um canal" como o maior
   * vazamento. Só que integração é recurso PAGO — ninguém conecta sem assinar.
   * O gráfico estava lendo o efeito do Pro como se fosse o caminho até ele.
   */
  it('conectar canal vem DEPOIS de assinar, porque integração é recurso pago', () => {
    const funil = montarFunilDeAtivacao([conta()])
    const etapas = funil.map((d) => d.etapa)
    expect(etapas.indexOf('virou_pro')).toBeLessThan(etapas.indexOf('conectou_canal'))
  })

  it('funil sem perda nenhuma não aponta vazamento', () => {
    const funil = montarFunilDeAtivacao(Array.from({ length: 6 }, () => conta()))
    expect(maiorVazamento(funil)).toBeNull()
  })
})

describe('recorte por período', () => {
  const agora = new Date('2026-08-23T12:00:00.000Z')

  it('mantém quem entrou dentro da janela', () => {
    const contas = [
      conta({ criadaEm: '2026-08-22T12:00:00.000Z' }),
      conta({ criadaEm: '2026-07-01T12:00:00.000Z' }),
    ]
    expect(apenasDosUltimosDias(contas, 30, agora)).toHaveLength(1)
  })

  // Sem este recorte, uma mudança boa no produto fica diluída em meses de
  // histórico ruim e ninguém consegue atribuir causa a nada.
  it('a janela é o que permite comparar antes e depois de uma mudança', () => {
    const contas = [
      conta({ criadaEm: '2026-08-23T00:00:00.000Z', temContato: true }),
      conta({ criadaEm: '2026-05-01T00:00:00.000Z', temContato: false }),
    ]

    const recentes = apenasDosUltimosDias(contas, 7, agora)
    expect(montarFunilDeAtivacao(recentes)[2].percentualDoTopo).toBe(100)
    expect(montarFunilDeAtivacao(contas)[2].percentualDoTopo).toBe(50)
  })
})
