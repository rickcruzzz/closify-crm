import { describe, expect, it } from 'vitest'

import { deveClassificar } from '@/lib/prospeccao/classificacao'

/**
 * O porteiro do classificador, e o defeito que ele fecha.
 *
 * Ate 18/09 toda mensagem recebida na empresa de prospeccao ia ao modelo, e o
 * webhook da Evolution captura TUDO que chega no numero. Medido nas 31
 * primeiras classificadas: **19 sairam `INCONCLUSIVO` e zero objecao foi
 * extraida**. A fila daquele dia explica sozinha, dez imagens e um PDF de
 * regimento interno de pousada.
 */
describe('deveClassificar', () => {
  it('texto de quem esta na fila e o caso que passa', () => {
    expect(deveClassificar({ tipo: 'texto', temProspect: true })).toEqual({ classificar: true })
  })

  /**
   * O caso que mais aparecia, e o mais sorrateiro.
   *
   * Imagem, audio, video, documento e figurinha chegam com um ROTULO no lugar
   * do conteudo (`"(enviou uma imagem)"`). O rotulo nao e vazio, entao o filtro
   * de texto vazio que ja existia os deixava passar inteiros para a OpenAI.
   */
  it.each(['imagem', 'audio', 'video', 'documento', 'figurinha', 'outro'])(
    'nao classifica %s, mesmo vindo de prospect',
    (tipo) => {
      expect(deveClassificar({ tipo, temProspect: true })).toEqual({
        classificar: false,
        motivo: 'sem_texto',
      })
    },
  )

  it('texto de quem NAO esta na fila nao vai ao modelo', () => {
    expect(deveClassificar({ tipo: 'texto', temProspect: false })).toEqual({
      classificar: false,
      motivo: 'fora_da_fila',
    })
  })

  /**
   * A ordem das duas portas importa para o NUMERO, nao para a decisao.
   *
   * Imagem de quem nao e prospect reprova nas duas. Contar como `fora_da_fila`
   * diria que a fila esta cheia de gente errada, quando o que ela tem e midia.
   * O tipo vem primeiro porque e o diagnostico mais util.
   */
  it('imagem de quem nao e prospect conta como sem_texto, nao fora_da_fila', () => {
    expect(deveClassificar({ tipo: 'imagem', temProspect: false }).motivo).toBe('sem_texto')
  })

  /**
   * Tipo desconhecido cai no lado seguro.
   *
   * `mensagens.tipo` tem sete valores no `check` de hoje, e um oitavo entraria
   * por migration sem passar por aqui. Aceitar por padrao mandaria o conteudo
   * novo ao modelo sem ninguem ter decidido isso.
   */
  it('tipo que ainda nao existe e recusado, nao aceito por omissao', () => {
    expect(deveClassificar({ tipo: 'enquete', temProspect: true }).classificar).toBe(false)
  })
})
