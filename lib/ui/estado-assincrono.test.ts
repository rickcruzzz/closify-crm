import { describe, expect, it } from 'vitest'

import { processando } from './estado-assincrono'

describe('processando', () => {
  /**
   * O caso do print, e o motivo deste arquivo existir.
   *
   * O dono concluiu uma tarefa num negócio que tinha OUTRA aberta. A segunda
   * virou a próxima ação, o botão continuou na tela, e o booleano antigo não
   * tinha como saber disso — spinner para sempre, até fechar o painel.
   */
  it('outra tarefa assumindo desliga o sinal sozinha', () => {
    expect(processando('tarefa-1', 'tarefa-2')).toBe(false)
  })

  // A proteção contra clique duplo, que a correção NÃO pode ter afrouxado:
  // enquanto for a mesma tarefa, o sinal segue ligado e o segundo clique
  // continua barrado. Foi medido com clique duplo real, 908ms de intervalo,
  // disparando a Server Action duas vezes.
  it('a mesma tarefa mantém o sinal ligado', () => {
    expect(processando('tarefa-1', 'tarefa-1')).toBe(true)
  })

  it('sem nada em voo, nada está processando', () => {
    expect(processando(null, 'tarefa-1')).toBe(false)
    expect(processando(undefined, 'tarefa-1')).toBe(false)
  })

  /**
   * A tarefa foi concluída e não havia outra: o bloco troca para o estado
   * vazio e o botão some. O sinal não tem mais o que descrever.
   *
   * Este caso precisa ser explícito porque `undefined === undefined` é `true`:
   * uma comparação ingênua travaria a tela sem ninguém ter clicado.
   */
  it('o alvo sumindo da tela desliga o sinal', () => {
    expect(processando('tarefa-1', null)).toBe(false)
    expect(processando('tarefa-1', undefined)).toBe(false)
  })

  it('nada em voo e nada na tela não é processando', () => {
    expect(processando(undefined, undefined)).toBe(false)
    expect(processando(null, null)).toBe(false)
  })

  // Serve para qualquer alvo identificável, não só tarefa.
  it('vale para qualquer tipo comparável', () => {
    expect(processando(7, 7)).toBe(true)
    expect(processando(7, 8)).toBe(false)
  })
})
