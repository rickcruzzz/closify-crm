import { describe, expect, it } from 'vitest'

import {
  DIAS_PRIMEIRO_DEGRAU,
  DIAS_SEGUNDO_DEGRAU,
  diasDeConexao,
  explicacaoDoTeto,
  tetoPorHora,
} from '@/lib/conversas/aquecimento'

/**
 * O número em risco é o DO CLIENTE, e por isso esta escada tinha que ter teste.
 *
 * O docstring de `remetente-zapi.ts` diz, em texto, que errar aqui *"destrói o
 * canal de vendas de quem pagou"* — e a regra não tinha um único caso travado,
 * porque morava num arquivo que o Vitest não consegue carregar.
 */

const AGORA = new Date('2026-09-23T12:00:00Z')
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString()

describe('tetoPorHora', () => {
  it('numero de hoje manda 10', () => {
    expect(tetoPorHora(diasAtras(0), AGORA)).toBe(10)
  })

  /**
   * Os dois cortes, um dia ANTES e um dia DEPOIS de cada um. É onde um `<=`
   * trocado por `<` passaria despercebido, e é justamente o erro que liberaria
   * volume um dia cedo demais num número novo.
   */
  it.each([
    [DIAS_PRIMEIRO_DEGRAU - 1, 10],
    [DIAS_PRIMEIRO_DEGRAU, 20],
    [DIAS_SEGUNDO_DEGRAU - 1, 20],
    [DIAS_SEGUNDO_DEGRAU, 30],
  ])('com %i dias de conexao o teto e %i', (dias, esperado) => {
    expect(tetoPorHora(diasAtras(dias), AGORA)).toBe(esperado)
  })

  it('numero velho fica em 30, e nao sobe mais', () => {
    expect(tetoPorHora(diasAtras(400), AGORA)).toBe(30)
  })

  /**
   * O lado seguro de errar: o pior que acontece com uma empresa antiga é
   * mandar devagar por uma hora. O contrário é um número novo mandando 30 e
   * sendo derrubado pela Meta.
   */
  describe('a ausencia e o lixo contam como numero NOVO', () => {
    it.each([null, '', 'nao e data', '0000-00-00'])('%s -> 10 por hora', (entrada) => {
      expect(tetoPorHora(entrada as string | null, AGORA)).toBe(10)
    })
  })

  /**
   * Data no FUTURO daria dias negativos, e `Math.floor` de um negativo desce
   * em vez de subir. Sem o `Math.max(0, ...)` isso continuaria no primeiro
   * degrau por acidente, e não por decisão.
   */
  it('data no futuro nao vira teto alto', () => {
    const amanha = new Date(AGORA.getTime() + 86_400_000).toISOString()
    expect(diasDeConexao(amanha, AGORA)).toBe(0)
    expect(tetoPorHora(amanha, AGORA)).toBe(10)
  })
})

describe('explicacaoDoTeto', () => {
  it('diz o MOTIVO, e nao so o numero', () => {
    // "10 por hora" sozinho lê como limitação do produto, e é o contrário: é o
    // produto protegendo o número da empresa. Quem entende isso não pede para
    // aumentar.
    expect(explicacaoDoTeto(diasAtras(1), AGORA)).toContain('protege o número')
  })

  it('cada degrau tem a sua frase, e elas sao distintas', () => {
    const frases = [
      explicacaoDoTeto(diasAtras(1), AGORA),
      explicacaoDoTeto(diasAtras(10), AGORA),
      explicacaoDoTeto(diasAtras(30), AGORA),
    ]
    expect(new Set(frases).size).toBe(3)
  })

  /**
   * O CONTROLE que liga as duas funções: a frase não pode anunciar um número
   * diferente do que o teto de fato aplica. Elas são lidas na mesma tela, uma
   * ao lado da outra.
   */
  it.each([1, 10, 30, 400])('a frase de %i dias anuncia o teto que vale', (dias) => {
    const quando = diasAtras(dias)
    expect(explicacaoDoTeto(quando, AGORA)).toContain(String(tetoPorHora(quando, AGORA)))
  })
})
