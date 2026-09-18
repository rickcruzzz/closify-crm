import { describe, expect, it } from 'vitest'

import {
  IDADE_MAXIMA_EM_HORAS,
  MAXIMO_DE_TENTATIVAS,
  deveReenviar,
  minutosAteAProxima,
  umaPorConversa,
  type MensagemDaFila,
} from '@/lib/whatsapp/reenvio'

const AGORA = new Date('2026-09-18T12:00:00Z')
const minutosAtras = (n: number) => new Date(AGORA.getTime() - n * 60_000).toISOString()

function msg(p: Partial<MensagemDaFila> = {}): MensagemDaFila {
  return {
    id: 'm1',
    conversaId: 'c1',
    workspaceId: 'w1',
    texto: 'Bom dia, segue o orçamento.',
    telefone: '5571999999999',
    tentativas: 0,
    externalId: null,
    criadaEm: minutosAtras(60),
    ...p,
  }
}

describe('deveReenviar', () => {
  it('falhou, nunca aceita, e a espera passou: reenvia', () => {
    expect(deveReenviar(msg(), AGORA)).toEqual({ reenviar: true })
  })

  /**
   * A porta que evita o pior erro possível desta fila.
   *
   * `external_id` preenchido quer dizer que a Z-API devolveu `zaapId`, ou seja
   * aceitou. Reenviar mandaria a MESMA mensagem duas vezes para o cliente.
   */
  it('com external_id NAO reenvia, mesmo marcada como falhou', () => {
    expect(deveReenviar(msg({ externalId: 'zaap-123' }), AGORA)).toEqual({
      reenviar: false,
      motivo: 'ja_aceita',
    })
  })

  /** Conversa de LID ou de grupo chega sem número aproveitável. */
  it('sem telefone nao reenvia', () => {
    expect(deveReenviar(msg({ telefone: null }), AGORA).reenviar).toBe(false)
    expect(deveReenviar(msg({ telefone: null }), AGORA)).toMatchObject({ motivo: 'sem_destino' })
  })

  it('no teto de tentativas, desiste', () => {
    expect(deveReenviar(msg({ tentativas: MAXIMO_DE_TENTATIVAS }), AGORA)).toEqual({
      reenviar: false,
      motivo: 'desistiu',
    })
  })

  /**
   * Achado no dado REAL: a fila de producao tinha uma mensagem de 26/08 com
   * `tentativas = 0`. Ela nunca foi tentada porque a empresa nunca teve
   * conexao de volta, entao a escada nunca comecou a correr — e no dia em que
   * aquela empresa parear um numero, a fila entregaria um texto de tres
   * semanas atras.
   */
  describe('a idade maxima', () => {
    it('mensagem de mais de 24h nao sai, mesmo NUNCA tendo sido tentada', () => {
      expect(
        deveReenviar(msg({ tentativas: 0, criadaEm: minutosAtras(25 * 60) }), AGORA),
      ).toEqual({ reenviar: false, motivo: 'velha_demais' })
    })

    it('dentro das 24h ainda sai', () => {
      expect(
        deveReenviar(msg({ tentativas: 0, criadaEm: minutosAtras(23 * 60) }), AGORA).reenviar,
      ).toBe(true)
    })

    /** O teto e o da constante, e nao um numero solto no meio da funcao. */
    it('o corte e IDADE_MAXIMA_EM_HORAS', () => {
      const umMinutoDepois = minutosAtras(IDADE_MAXIMA_EM_HORAS * 60 + 1)
      expect(deveReenviar(msg({ criadaEm: umMinutoDepois }), AGORA).reenviar).toBe(false)
    })

    /**
     * A ordem das portas: desistir por tentativas vem ANTES de velha demais.
     * Quem tentou cinco vezes tem um diagnostico melhor que "ficou velha".
     */
    it('esgotou as tentativas E e velha: conta como desistiu', () => {
      expect(
        deveReenviar(
          msg({ tentativas: MAXIMO_DE_TENTATIVAS, criadaEm: minutosAtras(100 * 60) }),
          AGORA,
        ),
      ).toMatchObject({ motivo: 'desistiu' })
    })
  })

  describe('a escada de espera', () => {
    /** Recém-criada: 2 minutos antes da primeira tentativa. */
    it('1 minuto depois de nascer ainda espera', () => {
      expect(deveReenviar(msg({ criadaEm: minutosAtras(1) }), AGORA)).toMatchObject({
        motivo: 'esperando',
      })
    })

    it('3 minutos depois de nascer ja reenvia', () => {
      expect(deveReenviar(msg({ criadaEm: minutosAtras(3) }), AGORA).reenviar).toBe(true)
    })

    /**
     * A espera é ACUMULADA a partir da criação: a segunda tentativa só acontece
     * depois de 2 + 10 = 12 minutos, e não 10 depois da primeira.
     */
    it('a segunda tentativa espera 12 minutos da CRIACAO, nao 10', () => {
      expect(
        deveReenviar(msg({ tentativas: 1, criadaEm: minutosAtras(11) }), AGORA),
      ).toMatchObject({ motivo: 'esperando' })
      expect(deveReenviar(msg({ tentativas: 1, criadaEm: minutosAtras(13) }), AGORA).reenviar).toBe(
        true,
      )
    })

    /** A quinta e última: 2 + 10 + 30 + 120 + 360 = 522 minutos. */
    it('a ultima tentativa so acontece perto das 9 horas', () => {
      expect(
        deveReenviar(msg({ tentativas: 4, criadaEm: minutosAtras(500) }), AGORA),
      ).toMatchObject({ motivo: 'esperando' })
      expect(
        deveReenviar(msg({ tentativas: 4, criadaEm: minutosAtras(530) }), AGORA).reenviar,
      ).toBe(true)
    })
  })

  /**
   * Data ilegível conta como AGORA: empurra para a rodada seguinte em vez de
   * liberar reenvio imediato. Errar segurando é barato; errar soltando manda
   * mensagem fora de hora.
   */
  it('data ilegivel segura, nao solta', () => {
    expect(deveReenviar(msg({ criadaEm: 'nao e data' }), AGORA)).toMatchObject({
      motivo: 'esperando',
    })
  })

  /** A ordem das portas: aceita vence tudo, inclusive o teto de tentativas. */
  it('aceita e no teto conta como aceita, e nao como desistencia', () => {
    expect(
      deveReenviar(msg({ externalId: 'zaap-9', tentativas: 99 }), AGORA).reenviar,
    ).toBe(false)
    expect(deveReenviar(msg({ externalId: 'zaap-9', tentativas: 99 }), AGORA)).toMatchObject({
      motivo: 'ja_aceita',
    })
  })
})

describe('minutosAteAProxima', () => {
  it('conta o que falta', () => {
    expect(minutosAteAProxima(msg({ criadaEm: minutosAtras(0) }), AGORA)).toBe(2)
  })

  it('nunca devolve negativo', () => {
    expect(minutosAteAProxima(msg({ criadaEm: minutosAtras(600) }), AGORA)).toBe(0)
  })
})

/**
 * Duas mensagens falhadas na mesma conversa foram escritas numa ordem, e o
 * cliente as lê na ordem em que chegarem. Reenviar as duas juntas permite que
 * a segunda chegue antes da primeira.
 */
describe('umaPorConversa', () => {
  it('leva a MAIS ANTIGA de cada conversa', () => {
    const fila = [
      msg({ id: 'a1', conversaId: 'c1', criadaEm: minutosAtras(90) }),
      msg({ id: 'a2', conversaId: 'c1', criadaEm: minutosAtras(60) }),
      msg({ id: 'b1', conversaId: 'c2', criadaEm: minutosAtras(30) }),
    ]
    expect(umaPorConversa(fila).map((m) => m.id)).toEqual(['a1', 'b1'])
  })

  it('fila vazia devolve vazia', () => {
    expect(umaPorConversa([])).toEqual([])
  })

  /** Conversas diferentes não competem entre si: a ordem só importa dentro. */
  it('nao descarta conversa nenhuma', () => {
    const fila = ['c1', 'c2', 'c3'].map((c, i) => msg({ id: `m${i}`, conversaId: c }))
    expect(umaPorConversa(fila)).toHaveLength(3)
  })
})
