import { describe, expect, it } from 'vitest'

import {
  minutosEsperando,
  ordenarPorEspera,
  quantasEsperando,
  textoDoRelogio,
  urgenciaDaConversa,
} from './ordenar'

const AGORA = new Date('2026-08-25T15:00:00Z')

function haMinutos(n: number): string {
  return new Date(AGORA.getTime() - n * 60_000).toISOString()
}

function conversa(over: Partial<Parameters<typeof minutosEsperando>[0]> = {}) {
  return {
    id: 'c1',
    ultimoRecebidoEm: haMinutos(3),
    respondidaEm: null,
    ultimoEnviadoEm: null,
    ...over,
  }
}

describe('minutosEsperando', () => {
  it('conta desde a última mensagem que chegou', () => {
    expect(minutosEsperando(conversa({ ultimoRecebidoEm: haMinutos(47) }), AGORA)).toBe(47)
  })

  // Contador em quem não espera é ruído, e ruído treina a pessoa a ignorar o
  // número. Mesma razão pela qual o contador de /hoje some no zero.
  it('quem já foi respondido não tem relógio', () => {
    expect(
      minutosEsperando(conversa({ respondidaEm: haMinutos(1) }), AGORA),
    ).toBeNull()
  })

  it('conversa que nunca recebeu mensagem não tem relógio', () => {
    expect(minutosEsperando(conversa({ ultimoRecebidoEm: null }), AGORA)).toBeNull()
  })

  // "esperando há -3 minutos" não é impreciso, é visivelmente quebrado. Relógio
  // adiantado do lado do cliente é comum o bastante para valer a trava.
  it('data no futuro vira zero, nunca negativo', () => {
    const futuro = new Date(AGORA.getTime() + 5 * 60_000).toISOString()
    expect(minutosEsperando(conversa({ ultimoRecebidoEm: futuro }), AGORA)).toBe(0)
  })

  it('data ilegível não quebra a tela', () => {
    expect(minutosEsperando(conversa({ ultimoRecebidoEm: 'nao-e-data' }), AGORA)).toBeNull()
  })
})

describe('urgenciaDaConversa', () => {
  /**
   * As duas fronteiras, com número literal de propósito.
   *
   * Escrever `MINUTOS_ATENCAO` aqui faria o teste concordar com qualquer valor
   * da constante, inclusive um errado. Os números crus são os medidos: 5
   * minutos é o que o cliente considera ideal, 10 é onde 40% já desistiram.
   */
  it('muda de cor exatamente em 5 e em 10 minutos', () => {
    const em = (m: number) =>
      urgenciaDaConversa(conversa({ ultimoRecebidoEm: haMinutos(m) }), AGORA)

    expect(em(4)).toBe('tranquila')
    expect(em(5)).toBe('atencao')
    expect(em(9)).toBe('atencao')
    expect(em(10)).toBe('urgente')
    expect(em(600)).toBe('urgente')
  })

  it('respondida não tem urgência, por mais antiga que seja', () => {
    expect(
      urgenciaDaConversa(
        conversa({ ultimoRecebidoEm: haMinutos(5000), respondidaEm: haMinutos(1) }),
        AGORA,
      ),
    ).toBe('respondida')
  })
})

describe('ordenarPorEspera', () => {
  /**
   * O caso que define a tela inteira, e que nenhum concorrente faz.
   *
   * Todo aplicativo de chat põe a mensagem mais RECENTE no topo. Aqui a mais
   * ANTIGA sobe, porque é ela que está prestes a desistir da compra.
   */
  it('quem espera há mais tempo fica no topo', () => {
    const lista = [
      conversa({ id: 'novo', ultimoRecebidoEm: haMinutos(3) }),
      conversa({ id: 'velho', ultimoRecebidoEm: haMinutos(47) }),
      conversa({ id: 'medio', ultimoRecebidoEm: haMinutos(12) }),
    ]
    expect(ordenarPorEspera(lista).map((c) => c.id)).toEqual(['velho', 'medio', 'novo'])
  })

  // Se a respondida subisse por ter mensagem recente, a tela viraria um chat
  // comum e perderia a única coisa que a torna útil.
  it('respondida fica embaixo mesmo tendo a mensagem mais recente', () => {
    const lista = [
      conversa({
        id: 'respondida-agora',
        ultimoRecebidoEm: haMinutos(1),
        respondidaEm: haMinutos(0.5),
      }),
      conversa({ id: 'esperando-ha-horas', ultimoRecebidoEm: haMinutos(300) }),
    ]
    expect(ordenarPorEspera(lista).map((c) => c.id)).toEqual([
      'esperando-ha-horas',
      'respondida-agora',
    ])
  })

  it('entre as respondidas, a mais recente vem primeiro', () => {
    const lista = [
      conversa({
        id: 'antiga',
        ultimoRecebidoEm: haMinutos(500),
        respondidaEm: haMinutos(400),
        ultimoEnviadoEm: haMinutos(400),
      }),
      conversa({
        id: 'recente',
        ultimoRecebidoEm: haMinutos(60),
        respondidaEm: haMinutos(30),
        ultimoEnviadoEm: haMinutos(30),
      }),
    ]
    expect(ordenarPorEspera(lista).map((c) => c.id)).toEqual(['recente', 'antiga'])
  })

  // Conversa que NÓS começamos e o cliente ainda não respondeu não está
  // esperando nada de nós: pôr ela no topo da fila de urgência mandaria a
  // pessoa responder a si mesma.
  it('conversa sem mensagem recebida não entra na fila de espera', () => {
    const lista = [
      conversa({ id: 'so-nossa', ultimoRecebidoEm: null, ultimoEnviadoEm: haMinutos(5) }),
      conversa({ id: 'esperando', ultimoRecebidoEm: haMinutos(2) }),
    ]
    expect(ordenarPorEspera(lista)[0].id).toBe('esperando')
  })

  // `NaN` em comparador produz ordem indefinida no V8: uma linha torta
  // embaralharia a lista inteira em vez de só se colocar mal.
  it('data ilegível não embaralha as outras', () => {
    const lista = [
      conversa({ id: 'torta', ultimoRecebidoEm: 'lixo' }),
      conversa({ id: 'velha', ultimoRecebidoEm: haMinutos(90) }),
      conversa({ id: 'nova', ultimoRecebidoEm: haMinutos(2) }),
    ]
    const ordem = ordenarPorEspera(lista).map((c) => c.id)
    expect(ordem.indexOf('velha')).toBeLessThan(ordem.indexOf('nova'))
  })

  it('não muta a lista recebida', () => {
    const lista = [
      conversa({ id: 'a', ultimoRecebidoEm: haMinutos(1) }),
      conversa({ id: 'b', ultimoRecebidoEm: haMinutos(9) }),
    ]
    const antes = lista.map((c) => c.id)
    ordenarPorEspera(lista)
    expect(lista.map((c) => c.id)).toEqual(antes)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(ordenarPorEspera([])).toEqual([])
  })
})

describe('textoDoRelogio', () => {
  it('fala como uma pessoa, nunca em segundos', () => {
    expect(textoDoRelogio(0.4)).toBe('agora')
    expect(textoDoRelogio(1)).toBe('1 min')
    expect(textoDoRelogio(47)).toBe('47 min')
    expect(textoDoRelogio(60)).toBe('1h')
    expect(textoDoRelogio(200)).toBe('3h')
  })

  it('concorda o singular em dias', () => {
    expect(textoDoRelogio(60 * 24)).toBe('1 dia')
    expect(textoDoRelogio(60 * 24 * 3)).toBe('3 dias')
  })
})

describe('quantasEsperando', () => {
  it('conta só quem está sem resposta', () => {
    const lista = [
      conversa({ id: '1' }),
      conversa({ id: '2', respondidaEm: haMinutos(1) }),
      conversa({ id: '3', ultimoRecebidoEm: null }),
      conversa({ id: '4', ultimoRecebidoEm: haMinutos(80) }),
    ]
    expect(quantasEsperando(lista)).toBe(2)
  })

  it('zero quando ninguém espera, para o contador poder sumir', () => {
    expect(quantasEsperando([conversa({ respondidaEm: haMinutos(1) })])).toBe(0)
  })
})
