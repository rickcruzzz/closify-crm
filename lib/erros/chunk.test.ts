import { describe, expect, it } from 'vitest'

import { deveRecarregar, ehErroDeChunk, JANELA_DE_RECARGA_MS } from './chunk'

describe('ehErroDeChunk', () => {
  it('pega o erro REAL de produção, o de 27/08 no /kanban', () => {
    // Quatro ocorrências em `error_logs`. É `__webpack_require__` recebendo
    // `undefined` no lugar da fábrica do módulo: a aba tem o mapa de chunks
    // da versão anterior e pede um arquivo que a promoção apagou.
    expect(
      ehErroDeChunk(new TypeError("Cannot read properties of undefined (reading 'call')")),
    ).toBe(true)
  })

  it('pega a variante do Safari, que escreve a mesma coisa de outro jeito', () => {
    expect(
      ehErroDeChunk(new TypeError("undefined is not an object (evaluating 'n.call')")),
    ).toBe(true)
  })

  it('pega ChunkLoadError pelo NOME, mesmo com a mensagem em branco', () => {
    const erro = new Error('')
    erro.name = 'ChunkLoadError'
    expect(ehErroDeChunk(erro)).toBe(true)
  })

  it('pega "Loading chunk N failed" e o import dinâmico que falhou', () => {
    expect(ehErroDeChunk(new Error('Loading chunk 2117 failed. (error: /_next/...)'))).toBe(true)
    expect(ehErroDeChunk(new Error('Failed to fetch dynamically imported module'))).toBe(true)
  })

  it('NÃO pega o outro erro do /kanban, que é defeito de verdade', () => {
    // React #185 é laço de `setState`. Recarregar não resolve, e recarregar
    // apagaria o rastro do defeito que a rodada de 06/09 existe para nomear.
    expect(
      ehErroDeChunk(new Error('Minified React error #185; visit https://react.dev/errors/185')),
    ).toBe(false)
  })

  it('NÃO pega erro comum de aplicação', () => {
    expect(ehErroDeChunk(new Error('Não foi possível salvar o negócio'))).toBe(false)
    expect(ehErroDeChunk(new TypeError('x.map is not a function'))).toBe(false)
  })

  it('aguenta o que não é erro sem explodir', () => {
    // O boundary recebe o que foi lançado, e nem tudo que se lança é `Error`.
    expect(ehErroDeChunk(null)).toBe(false)
    expect(ehErroDeChunk(undefined)).toBe(false)
    expect(ehErroDeChunk('ChunkLoadError')).toBe(false)
    expect(ehErroDeChunk({})).toBe(false)
  })
})

describe('deveRecarregar', () => {
  it('a primeira vez da aba sempre pode', () => {
    expect(deveRecarregar(1_000_000, null)).toBe(true)
  })

  it('recusa a segunda dentro da janela, a trava contra o ciclo', () => {
    // Sem isto, um erro que sobrevive ao reload vira
    // recarregar-quebrar-recarregar, e a pessoa não consegue nem ler a
    // mensagem nem sair da tela. É a falha mais cara que a recuperação
    // automática pode produzir.
    const agora = 1_000_000
    expect(deveRecarregar(agora, agora - 1_000)).toBe(false)
    expect(deveRecarregar(agora, agora - JANELA_DE_RECARGA_MS)).toBe(false)
  })

  it('libera depois da janela', () => {
    const agora = 1_000_000
    expect(deveRecarregar(agora, agora - JANELA_DE_RECARGA_MS - 1)).toBe(true)
  })

  it('trata marca ilegível como primeira vez', () => {
    // `Number(sessionStorage.getItem(...))` devolve `NaN` para lixo, e
    // qualquer comparação com `NaN` é falsa — o que travaria a recarga para
    // sempre em silêncio, exatamente o oposto do que se quer.
    expect(deveRecarregar(1_000_000, Number('abacaxi'))).toBe(true)
  })
})
