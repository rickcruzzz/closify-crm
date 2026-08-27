import { describe, expect, it } from 'vitest'

import { atalhosDePrazo, paraCampoLocal, sugestaoDePrazo } from './atalhos-de-prazo'

/**
 * As datas são construídas com `new Date(ano, mes, dia, hora)`, que interpreta
 * no fuso de quem roda o teste — o mesmo fuso em que `atalhosDePrazo` trabalha,
 * porque o valor final vai para um `<input type="datetime-local">`, que não
 * tem fuso e mostra o horário de quem está olhando.
 *
 * Usar `new Date('...Z')` aqui faria o teste passar ou falhar conforme a
 * máquina, que é exatamente o defeito que ele deveria pegar.
 */
const em = (ano: number, mes: number, dia: number, hora: number, minuto = 0) =>
  new Date(ano, mes - 1, dia, hora, minuto, 0, 0)

const porId = (agora: Date) =>
  Object.fromEntries(atalhosDePrazo(agora).map((a) => [a.id, a]))

describe('atalhosDePrazo', () => {
  // Quarta-feira, 26/08/2026.
  it('antes das 9h, "Hoje" é às 9h de hoje', () => {
    const { hoje } = porId(em(2026, 8, 26, 7, 30))
    expect(hoje.valor).toBe('2026-08-26T09:00')
    expect(hoje.rotulo).toBe('Hoje, 09:00')
  })

  /**
   * O defeito que este caso existe para impedir: oferecer "Hoje, 09:00" às
   * três da tarde marca a tarefa como atrasada no instante em que ela nasce.
   * E nada reclamaria — o piso de `taskSchema` é um ano atrás, de propósito,
   * para aceitar quem registra algo esquecido da semana passada.
   */
  it('depois das 9h, "Hoje" vira a próxima hora cheia, nunca 9h no passado', () => {
    const { hoje } = porId(em(2026, 8, 26, 14, 40))
    expect(hoje.valor).toBe('2026-08-26T15:00')
    expect(hoje.rotulo).toBe('Hoje, 15:00')
  })

  it('tarde da noite, "Hoje" desaparece em vez de apontar para a madrugada', () => {
    const atalhos = porId(em(2026, 8, 26, 23, 10))
    expect(atalhos.hoje).toBeUndefined()
    expect(atalhos.amanha).toBeDefined()
  })

  it('"Amanhã" é sempre 9h do dia seguinte', () => {
    const { amanha } = porId(em(2026, 8, 26, 14, 40))
    expect(amanha.valor).toBe('2026-08-27T09:00')
  })

  // Numa segunda, "Segunda" apontando para hoje não é atalho, é engano.
  it('na segunda-feira, "Segunda" é a da semana que vem', () => {
    // 31/08/2026 é uma segunda.
    const segundaFeira = em(2026, 8, 31, 10, 0)
    expect(segundaFeira.getDay()).toBe(1)
    expect(porId(segundaFeira).segunda.valor).toBe('2026-09-07T09:00')
  })

  it('no domingo, "Segunda" some porque seria idêntica a "Amanhã"', () => {
    // 30/08/2026 é um domingo.
    const domingo = em(2026, 8, 30, 10, 0)
    expect(domingo.getDay()).toBe(0)

    const atalhos = porId(domingo)
    expect(atalhos.amanha.valor).toBe('2026-08-31T09:00')
    expect(atalhos.segunda).toBeUndefined()
  })

  it('no sábado, "Segunda" é daqui a dois dias', () => {
    const sabado = em(2026, 8, 29, 10, 0)
    expect(sabado.getDay()).toBe(6)
    expect(porId(sabado).segunda.valor).toBe('2026-08-31T09:00')
  })

  // A regra que vale para todos: atalho que grava passado é armadilha.
  it('nenhum atalho, em nenhuma hora do dia, cai no passado', () => {
    for (let hora = 0; hora < 24; hora++) {
      const agora = em(2026, 8, 26, hora, 30)
      for (const atalho of atalhosDePrazo(agora)) {
        expect(
          new Date(atalho.valor).getTime(),
          `${atalho.id} às ${hora}h caiu no passado (${atalho.valor})`,
        ).toBeGreaterThan(agora.getTime())
      }
    }
  })

  // O rótulo é derivado do valor de propósito: escrever "Hoje 9h" à mão num
  // botão que grava outra coisa marca reunião na hora errada e ninguém vê.
  it('o rótulo sempre bate com a hora que o valor grava', () => {
    for (const hora of [6, 9, 13, 20]) {
      for (const atalho of atalhosDePrazo(em(2026, 8, 26, hora, 15))) {
        expect(atalho.rotulo).toContain(atalho.valor.slice(11))
      }
    }
  })
})

describe('sugestaoDePrazo', () => {
  it('o formulário nasce em amanhã às 9h', () => {
    expect(sugestaoDePrazo(em(2026, 8, 26, 14, 40))).toBe('2026-08-27T09:00')
  })
})

describe('paraCampoLocal', () => {
  /**
   * `toISOString()` daria o horário em UTC e o campo abriria três horas
   * adiantado para quem está em São Paulo. O corte tem que cair no horário
   * local, que é o que o `<input type="datetime-local">` mostra.
   */
  it('devolve o horário local, não o UTC', () => {
    expect(paraCampoLocal(em(2026, 8, 26, 9, 0))).toBe('2026-08-26T09:00')
  })
})
