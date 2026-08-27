import { describe, expect, it } from 'vitest'

import { escopoAtendido, listaDeEscopos } from './escopo-concedido'

const CALENDAR = 'https://www.googleapis.com/auth/calendar.events.owned'
const CALENDAR_LARGO = 'https://www.googleapis.com/auth/calendar.events'
const GMAIL = 'https://www.googleapis.com/auth/gmail.send'

describe('escopoAtendido', () => {
  /**
   * O defeito que motivou o arquivo: a caixa de permissão da tela do Google
   * vem DESMARCADA. Continuar sem marcar devolve token válido sem o escopo, e
   * o callback gravava isso como "conectado com sucesso".
   */
  it('recusa quando a permissão não foi concedida', () => {
    const soIdentidade = ['openid', 'https://www.googleapis.com/auth/userinfo.email']
    expect(escopoAtendido(soIdentidade, CALENDAR)).toBe(false)
    expect(escopoAtendido(soIdentidade, GMAIL)).toBe(false)
  })

  it('aceita o escopo exato', () => {
    expect(escopoAtendido([CALENDAR, 'openid'], CALENDAR)).toBe(true)
  })

  /**
   * Medido em produção: `pedroescobar90sb@gmail.com` conectou antes da troca
   * de escopo de 23/08 e carrega `calendar.events`, que CONTÉM
   * `calendar.events.owned`. A conexão funciona, e a comparação exata do
   * "Testar conexão" dizia que não.
   */
  it('aceita o escopo largo antigo, que engloba o exigido', () => {
    expect(escopoAtendido([CALENDAR_LARGO], CALENDAR)).toBe(true)
    expect(escopoAtendido(['https://www.googleapis.com/auth/calendar'], CALENDAR)).toBe(true)
  })

  // A relação tem DIREÇÃO. Quem concedeu só o restrito não pode agir sobre
  // calendário de terceiro, e aceitar aqui seria afirmar uma permissão que a
  // pessoa não deu.
  it('não aceita o restrito no lugar do largo', () => {
    expect(escopoAtendido([CALENDAR], CALENDAR_LARGO)).toBe(false)
  })

  // Os dois compartilham prefixo nos dois sentidos: uma comparação por
  // `startsWith` passaria nos dois casos acima e erraria um deles.
  it('escopo de outro provedor não serve', () => {
    expect(escopoAtendido([GMAIL], CALENDAR)).toBe(false)
    expect(escopoAtendido([CALENDAR], GMAIL)).toBe(false)
  })

  it('lista vazia nunca atende', () => {
    expect(escopoAtendido([], CALENDAR)).toBe(false)
  })
})

describe('listaDeEscopos', () => {
  it('separa por espaço', () => {
    expect(listaDeEscopos(`openid ${GMAIL}`)).toEqual(['openid', GMAIL])
  })

  /**
   * `split(' ')` deixaria `"\ngmail.send"` como item, que não casa com nada e
   * faria uma conexão boa parecer sem permissão. É a mesma classe do ID do
   * Pixel que chegou com quebra de linha e derrubou o site inteiro.
   */
  it('sobrevive a quebra de linha e espaço duplo', () => {
    expect(listaDeEscopos(`openid\n  ${GMAIL} `)).toEqual(['openid', GMAIL])
  })

  it('nulo e vazio devolvem lista vazia, não [""]', () => {
    expect(listaDeEscopos(null)).toEqual([])
    expect(listaDeEscopos('')).toEqual([])
    expect(listaDeEscopos(undefined)).toEqual([])
  })
})
