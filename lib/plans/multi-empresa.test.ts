import { describe, expect, it } from 'vitest'

import { PRO_WORKSPACE_LIMIT } from '@/lib/plans'
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

  it('assinatura paga libera enquanto estiver ABAIXO do teto de 5', () => {
    // Este caso se chamava "libera, com quantas empresas ja tiver" e travava o
    // defeito: o caminho pago devolvia `pode: true` incondicionalmente, e
    // `quantidadeDeEmpresas` chegava na funcao para ser ignorado.
    for (const quantas of [0, 1, 3, 4]) {
      expect(
        decidirNovaEmpresa({
          temAssinaturaPaga: true,
          emTrial: false,
          quantidadeDeEmpresas: quantas,
        }),
      ).toEqual({ pode: true, motivo: null, tipo: null })
    }
  })

  it('assinatura paga com CINCO empresas NAO pode criar a sexta', () => {
    // A 0078 aplica `teto := case when tem_plano_pro then 5 else 1 end` e
    // levanta excecao na sexta. Sem este caso, quem paga via "Nova empresa"
    // disponivel, preenchia o dialogo e tomava o erro do banco — que e o
    // defeito que este arquivo inteiro nasceu para consertar, um degrau acima.
    const d = decidirNovaEmpresa({
      temAssinaturaPaga: true,
      emTrial: false,
      quantidadeDeEmpresas: PRO_WORKSPACE_LIMIT,
    })
    expect(d.pode).toBe(false)
    expect(d.motivo).toContain(`${PRO_WORKSPACE_LIMIT} empresas`)
  })

  it('a fronteira e EXATAMENTE o teto, nao um a menos nem um a mais', () => {
    expect(
      decidirNovaEmpresa({
        temAssinaturaPaga: true,
        emTrial: false,
        quantidadeDeEmpresas: PRO_WORKSPACE_LIMIT - 1,
      }).pode,
    ).toBe(true)
    expect(
      decidirNovaEmpresa({
        temAssinaturaPaga: true,
        emTrial: false,
        quantidadeDeEmpresas: PRO_WORKSPACE_LIMIT,
      }).pode,
    ).toBe(false)
  })

  it('acima do teto continua recusando, e nao volta a liberar', () => {
    // Estado possivel: concessao manual, ou o teto baixar no futuro. Um `===`
    // no lugar do `<` deixaria a sexta empresa recusada e a setima liberada.
    expect(
      decidirNovaEmpresa({
        temAssinaturaPaga: true,
        emTrial: false,
        quantidadeDeEmpresas: 9,
      }).pode,
    ).toBe(false)
  })

  it('a frase do Pro e a MESMA do servidor e da 0078', () => {
    // Duas mensagens diferentes para a mesma recusa fazem a pessoa achar que
    // sao dois problemas. `lib/limits.ts` devolve esta string exata.
    const d = decidirNovaEmpresa({
      temAssinaturaPaga: true,
      emTrial: false,
      quantidadeDeEmpresas: PRO_WORKSPACE_LIMIT,
    })
    expect(d.motivo).toBe(
      `O plano Pro inclui ${PRO_WORKSPACE_LIMIT} empresas. Fale com a gente para ter mais.`,
    )
  })

  it('a recusa do Pro NAO manda fazer upgrade: ele ja pagou', () => {
    const d = decidirNovaEmpresa({
      temAssinaturaPaga: true,
      emTrial: false,
      quantidadeDeEmpresas: PRO_WORKSPACE_LIMIT,
    })
    expect(d.motivo).not.toMatch(/upgrade|assine|dispon[ií]vel no plano/i)
  })

  // Nasce sem empresa nenhuma: o Free inclui uma, e barrar aqui trancaria a
  // conta antes de ela existir.
  it('sem nenhuma empresa, pode criar a primeira mesmo no Free', () => {
    const d = decidirNovaEmpresa({
      temAssinaturaPaga: false,
      emTrial: false,
      quantidadeDeEmpresas: 0,
    })
    expect(d).toEqual({ pode: true, motivo: null, tipo: null })
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
    // O primeiro caso usava `quantidadeDeEmpresas: 5` e esperava `pode: true`.
    // Ele tambem travava o defeito do teto ausente — dois testes afirmavam o
    // comportamento errado, que e como um limite vira decorativo.
    const casos = [
      { temAssinaturaPaga: true, emTrial: false, quantidadeDeEmpresas: 4 },
      { temAssinaturaPaga: false, emTrial: false, quantidadeDeEmpresas: 0 },
      { temAssinaturaPaga: false, emTrial: true, quantidadeDeEmpresas: 0 },
    ]
    for (const caso of casos) {
      const d = decidirNovaEmpresa(caso)
      expect(d.pode).toBe(true)
      expect(d.motivo).toBeNull()
    }
  })

  it('quem NAO pode sempre carrega motivo, e ele nunca e vazio', () => {
    // O invariante inverso. Sem ele, um caminho de recusa pode devolver
    // `motivo: null` e a tela desabilita o botao sem dizer por que — que e a
    // pior combinacao possivel: a pessoa ve que nao da e nao sabe o que fazer.
    const casos = [
      {
        temAssinaturaPaga: true,
        emTrial: false,
        quantidadeDeEmpresas: PRO_WORKSPACE_LIMIT,
      },
      { temAssinaturaPaga: false, emTrial: false, quantidadeDeEmpresas: 1 },
      { temAssinaturaPaga: false, emTrial: true, quantidadeDeEmpresas: 1 },
    ]
    for (const caso of casos) {
      const d = decidirNovaEmpresa(caso)
      expect(d.pode).toBe(false)
      expect(d.motivo).toBeTruthy()
    }
  })

  it('a recusa diz QUAL recusa e, e a tela nao le a frase para decidir', () => {
    // As duas recusas pedem telas opostas: o Free ganha a oferta do Pro, o Pro
    // no teto ganha um item desabilitado. Fazer a tela escolher comparando
    // string faria uma correcao de copy virar defeito de roteamento.
    expect(
      decidirNovaEmpresa({
        temAssinaturaPaga: true,
        emTrial: false,
        quantidadeDeEmpresas: PRO_WORKSPACE_LIMIT,
      }).tipo,
    ).toBe('limite_do_pro')
    expect(
      decidirNovaEmpresa({
        temAssinaturaPaga: false,
        emTrial: false,
        quantidadeDeEmpresas: 1,
      }).tipo,
    ).toBe('exige_pro')
    expect(
      decidirNovaEmpresa({
        temAssinaturaPaga: false,
        emTrial: true,
        quantidadeDeEmpresas: 1,
      }).tipo,
    ).toBe('exige_pro')
  })

  it('quem PODE nao carrega tipo', () => {
    expect(
      decidirNovaEmpresa({
        temAssinaturaPaga: true,
        emTrial: false,
        quantidadeDeEmpresas: 0,
      }).tipo,
    ).toBeNull()
  })
})
