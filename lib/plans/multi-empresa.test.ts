import { describe, expect, it } from 'vitest'

import { decidirNovaEmpresa } from './multi-empresa'

describe('decidirNovaEmpresa', () => {
  /**
   * O defeito que motivou o arquivo, medido em produção em 27/08/2026.
   *
   * Durante o trial `plan` vale `'pro'`, mas a trigger da 0053 exige
   * `pro_vigente and not em_trial`. A tela mostrava "Nova empresa", a pessoa
   * digitava o nome, enviava, e o banco recusava. Quatro empresas estavam
   * nesse estado no momento da medição.
   */
  it('quem está em trial com uma empresa NÃO pode criar a segunda', () => {
    const d = decidirNovaEmpresa({
      temAssinaturaPaga: false,
      emTrial: true,
      quantidadeDeEmpresas: 1,
    })
    expect(d.pode).toBe(false)
  })

  // A RPC responde "O plano Free inclui 1 empresa" a quem tem o selo `pro` na
  // tela. Aqui a frase precisa reconhecer o trial, senão o produto contradiz a
  // própria interface.
  it('a quem está em trial, o motivo não diz "Free"', () => {
    const { motivo } = decidirNovaEmpresa({
      temAssinaturaPaga: false,
      emTrial: true,
      quantidadeDeEmpresas: 1,
    })
    expect(motivo).not.toMatch(/free/i)
    expect(motivo).toBe('Assine o Pro para ter mais de uma')
  })

  it('quem está no Free com uma empresa recebe a frase do Free', () => {
    const { pode, motivo } = decidirNovaEmpresa({
      temAssinaturaPaga: false,
      emTrial: false,
      quantidadeDeEmpresas: 1,
    })
    expect(pode).toBe(false)
    expect(motivo).toBe('Disponível no plano Pro')
  })

  it('assinatura paga libera, com quantas empresas já tiver', () => {
    for (const quantidadeDeEmpresas of [1, 3, 10]) {
      expect(
        decidirNovaEmpresa({ temAssinaturaPaga: true, emTrial: false, quantidadeDeEmpresas }).pode,
      ).toBe(true)
    }
  })

  // Nasce sem empresa nenhuma: o Free inclui uma, e barrar aqui trancaria a
  // conta antes de ela existir.
  it('sem nenhuma empresa, pode criar a primeira mesmo no Free', () => {
    const d = decidirNovaEmpresa({
      temAssinaturaPaga: false,
      emTrial: false,
      quantidadeDeEmpresas: 0,
    })
    expect(d).toEqual({ pode: true, motivo: null })
  })

  /**
   * A combinação impossível, travada de propósito.
   *
   * `situacaoDoPlanoDaEmpresaAtiva` calcula `temAssinaturaPaga` como
   * `proVigente && !emTrial`, então os dois nunca chegam verdadeiros juntos.
   * Se algum dia chegarem, o certo é a assinatura paga vencer — ela é o que a
   * trigger aceita.
   */
  it('assinatura paga vence o trial, se os dois vierem verdadeiros', () => {
    const d = decidirNovaEmpresa({
      temAssinaturaPaga: true,
      emTrial: true,
      quantidadeDeEmpresas: 1,
    })
    expect(d.pode).toBe(true)
  })

  it('quem pode nunca carrega motivo', () => {
    const casos = [
      { temAssinaturaPaga: true, emTrial: false, quantidadeDeEmpresas: 5 },
      { temAssinaturaPaga: false, emTrial: false, quantidadeDeEmpresas: 0 },
      { temAssinaturaPaga: false, emTrial: true, quantidadeDeEmpresas: 0 },
    ]
    for (const caso of casos) {
      const d = decidirNovaEmpresa(caso)
      expect(d.pode).toBe(true)
      expect(d.motivo).toBeNull()
    }
  })
})
