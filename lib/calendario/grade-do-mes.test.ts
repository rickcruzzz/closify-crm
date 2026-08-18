import { describe, expect, it } from 'vitest'

import {
  diaEstaNoIntervalo,
  gradeDoMes,
  rotuloDoDiaPorExtenso,
  rotuloDoMes,
} from './grade-do-mes'

describe('gradeDoMes', () => {
  it('sempre devolve 42 células (6 semanas), mesmo em meses curtos', () => {
    // Fevereiro de 2026 (28 dias, não bissexto) começa numa quarta-feira —
    // o caso onde uma grade "só o necessário" teria 5 semanas, não 6.
    expect(gradeDoMes(2026, 2)).toHaveLength(42)
  })

  it('agosto de 2026 começa no sábado: a primeira célula é do mês anterior', () => {
    const grade = gradeDoMes(2026, 8)
    expect(grade[0]).toEqual({ dia: '2026-07-26', numeroDoDia: 26, ehDoMesCorrente: false })
    // 1º de agosto de 2026 é sábado, cai na 7ª posição (índice 6) da 1ª semana.
    expect(grade[6]).toEqual({ dia: '2026-08-01', numeroDoDia: 1, ehDoMesCorrente: true })
  })

  it('último dia do mês corrente aparece marcado corretamente', () => {
    const grade = gradeDoMes(2026, 8)
    const dia31 = grade.find((c) => c.dia === '2026-08-31')
    expect(dia31?.ehDoMesCorrente).toBe(true)
  })

  it('dezembro rola para o mês seguinte de janeiro do ano seguinte sem quebrar', () => {
    const grade = gradeDoMes(2026, 12)
    const ultimaCelula = grade[41]!
    expect(ultimaCelula.dia >= '2027-01-01').toBe(true)
  })

  // O defeito que este teste evita: `new Date(ano, mes-1, 1)` SEM `UTC` usa o
  // fuso da máquina que roda o teste, e num fuso negativo (Brasil) pode
  // voltar um dia — mesma armadilha que `docs/estado-atual.md` já documenta
  // para `diaEmSaoPaulo`. Aqui o cálculo é local por natureza (grade de
  // calendário, não instante), então usa `Date.UTC` para ser determinístico
  // em qualquer fuso de execução.
  it('janeiro começa no dia 1 independente do fuso de quem roda o teste', () => {
    const grade = gradeDoMes(2026, 1)
    const dia1 = grade.find((c) => c.dia === '2026-01-01')
    expect(dia1?.ehDoMesCorrente).toBe(true)
    expect(dia1?.numeroDoDia).toBe(1)
  })
})

describe('rotuloDoMes', () => {
  it('formata mês por extenso, capitalizado, em português', () => {
    expect(rotuloDoMes(2026, 8)).toBe('Agosto de 2026')
  })

  it('janeiro formata corretamente', () => {
    expect(rotuloDoMes(2026, 1)).toBe('Janeiro de 2026')
  })
})

describe('rotuloDoDiaPorExtenso', () => {
  it('formata dia da semana, dia e mês por extenso, capitalizado', () => {
    expect(rotuloDoDiaPorExtenso('2026-08-18')).toBe('Terça-feira, 18 de agosto')
  })
})

describe('diaEstaNoIntervalo', () => {
  it('dia dentro do intervalo é true, incluindo as pontas', () => {
    expect(diaEstaNoIntervalo('2026-08-15', '2026-08-10', '2026-08-20')).toBe(true)
    expect(diaEstaNoIntervalo('2026-08-10', '2026-08-10', '2026-08-20')).toBe(true)
    expect(diaEstaNoIntervalo('2026-08-20', '2026-08-10', '2026-08-20')).toBe(true)
  })

  it('dia fora do intervalo é false', () => {
    expect(diaEstaNoIntervalo('2026-08-09', '2026-08-10', '2026-08-20')).toBe(false)
    expect(diaEstaNoIntervalo('2026-08-21', '2026-08-10', '2026-08-20')).toBe(false)
  })

  it('sem início ou sem fim (seleção incompleta) é sempre false', () => {
    expect(diaEstaNoIntervalo('2026-08-15', '2026-08-10', null)).toBe(false)
    expect(diaEstaNoIntervalo('2026-08-15', null, '2026-08-20')).toBe(false)
  })

  // O hover preview antes do segundo clique: início e fim podem chegar
  // invertidos (a pessoa clicou primeiro numa data mais tarde, e o hover
  // preview está numa mais cedo). A função não assume ordem.
  it('funciona com início e fim invertidos (hover preview antes do 2º clique)', () => {
    expect(diaEstaNoIntervalo('2026-08-15', '2026-08-20', '2026-08-10')).toBe(true)
  })
})
