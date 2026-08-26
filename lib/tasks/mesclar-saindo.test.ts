import { describe, expect, it } from 'vitest'

import { mesclarSaindo, type EmSaida } from './mesclar-saindo'

type Item = { id: string; done_at?: string | null }

const item = (id: string): Item => ({ id })

function saindo(...entradas: Array<[string, number]>): Map<string, EmSaida<Item>> {
  return new Map(entradas.map(([id, indice]) => [id, { task: item(id), indice }]))
}

describe('mesclarSaindo', () => {
  it('sem ninguém saindo, devolve o que o servidor mandou', () => {
    const servidor = [item('a'), item('b')]
    expect(mesclarSaindo(servidor, new Map()).map((t) => t.id)).toEqual(['a', 'b'])
  })

  /**
   * O caso que motivou o arquivo.
   *
   * O servidor já removeu a tarefa concluída, mas ela precisa continuar
   * visível até o tempo de desfazer acabar.
   */
  it('segura na tela quem o servidor já removeu', () => {
    const servidor = [item('b'), item('c')]
    const lista = mesclarSaindo(servidor, saindo(['a', 0]))
    expect(lista.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  // Sem a posição, a linha riscada iria para o fim: o olho a perde, e o
  // "Desfazer" fica impossível de acertar.
  it('devolve a tarefa à posição original, não ao fim', () => {
    const servidor = [item('a'), item('c'), item('d')]
    const lista = mesclarSaindo(servidor, saindo(['b', 1]))
    expect(lista.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('duas saindo ao mesmo tempo, cada uma no seu lugar', () => {
    const servidor = [item('c'), item('e')]
    const lista = mesclarSaindo(servidor, saindo(['a', 0], ['b', 1], ['d', 3]))
    expect(lista.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  // Ordem de inserção importa: de trás para frente, a segunda empurraria a
  // primeira e as duas cairiam no lugar errado.
  it('a ordem do Map não muda o resultado', () => {
    const servidor = [item('c')]
    const foraDeOrdem = mesclarSaindo(servidor, saindo(['b', 1], ['a', 0]))
    const emOrdem = mesclarSaindo(servidor, saindo(['a', 0], ['b', 1]))
    expect(foraDeOrdem.map((t) => t.id)).toEqual(emOrdem.map((t) => t.id))
  })

  /**
   * Corrida real: a pessoa clica em "Desfazer" e o servidor devolve a tarefa
   * à lista antes de o estado local limpar `saindo`. Sem esta trava, ela
   * apareceria duas vezes.
   */
  it('não duplica quem o servidor já devolveu', () => {
    const servidor = [item('a'), item('b')]
    const lista = mesclarSaindo(servidor, saindo(['a', 0]))
    expect(lista.map((t) => t.id)).toEqual(['a', 'b'])
  })

  // Alguém em outra aba concluiu três tarefas enquanto esta janela corria: o
  // índice guardado aponta para fora da lista nova.
  it('índice fora do intervalo prende ao fim, em vez de sumir', () => {
    const servidor = [item('x')]
    const lista = mesclarSaindo(servidor, saindo(['a', 9]))
    expect(lista.map((t) => t.id)).toEqual(['x', 'a'])
  })

  it('índice negativo vai para o começo', () => {
    const servidor = [item('x')]
    const lista = mesclarSaindo(servidor, saindo(['a', -3]))
    expect(lista.map((t) => t.id)).toEqual(['a', 'x'])
  })

  /**
   * O defeito de 26/08, medido em produção.
   *
   * `concluirTarefa` leva ~1,5s. Durante esse tempo o servidor ainda manda a
   * tarefa ABERTA, e a versão anterior descartava a cópia local por causa
   * disso: o clique ficava um segundo e meio sem risco e sem checkbox marcado.
   */
  it('a cópia local vence a do servidor, em vez de ser descartada', () => {
    const servidor: Item[] = [{ id: 'a', done_at: null }, { id: 'b', done_at: null }]
    const janela = new Map<string, EmSaida<Item>>([
      ['a', { task: { id: 'a', done_at: '2026-08-26T12:00:00Z' }, indice: 0 }],
    ])
    const lista = mesclarSaindo(servidor, janela)
    expect(lista.map((t) => t.id)).toEqual(['a', 'b'])
    expect(lista[0]?.done_at).toBe('2026-08-26T12:00:00Z')
  })

  // O caminho do "Desfazer": a cópia local volta a `done_at: null` e continua
  // vencendo, para a linha desmarcar na hora em vez de esperar a viagem.
  it('a cópia local também vence quando ela é a reaberta', () => {
    const servidor: Item[] = [{ id: 'a', done_at: '2026-08-26T12:00:00Z' }]
    const janela = new Map<string, EmSaida<Item>>([
      ['a', { task: { id: 'a', done_at: null }, indice: 0 }],
    ])
    expect(mesclarSaindo(servidor, janela)[0]?.done_at).toBeNull()
  })

  it('não muta a lista do servidor', () => {
    const servidor = [item('b')]
    mesclarSaindo(servidor, saindo(['a', 0]))
    expect(servidor.map((t) => t.id)).toEqual(['b'])
  })

  it('servidor vazio ainda mostra quem está saindo', () => {
    const lista = mesclarSaindo([], saindo(['a', 0]))
    expect(lista.map((t) => t.id)).toEqual(['a'])
  })
})
