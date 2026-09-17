import { describe, expect, it } from 'vitest'

import { PLANO_NA_TELA, rotuloDoPlano } from '@/lib/plans'

describe('rotuloDoPlano', () => {
  it('Max vence a coluna, e é o caso que motivou a função', () => {
    // Visto em produção em 17/09: o seletor dizia "Pro" para quem paga R$ 250.
    // `workspaces.plan` vale 'pro' para o Max POR CONSTRUÇÃO — é o desenho da
    // 0089, que deixou `pro_vigente()` intacto para os sete lugares que a leem.
    expect(rotuloDoPlano('pro', true)).toBe('Max')
  })

  it('Pro pagante continua Pro', () => {
    expect(rotuloDoPlano('pro', false)).toBe('Pro')
  })

  it('Free continua Free', () => {
    expect(rotuloDoPlano('free', false)).toBe('Free')
  })

  it('valor desconhecido na coluna cai em Free, e não em Pro', () => {
    // O lado seguro de errar: anunciar plano MENOR do que a pessoa tem gera uma
    // pergunta; anunciar MAIOR promete recurso que o banco vai recusar.
    expect(rotuloDoPlano('', false)).toBe('Free')
    expect(rotuloDoPlano('enterprise', false)).toBe('Free')
  })

  it('a coluna dizendo free com Max vigente ainda mostra Max', () => {
    // Não deveria acontecer, e se acontecer a função é a fonte da verdade:
    // `max_vigente()` responde o que vale agora, a coluna é só o último valor
    // gravado pela RPC do webhook.
    expect(rotuloDoPlano('free', true)).toBe('Max')
  })

  it('só devolve nomes que PLANO_NA_TELA conhece', () => {
    // Sem isto, um rótulo novo poderia nascer aqui sem entrar na lista que a
    // tela de cobrança e a de comparação leem, e as três diriam nomes
    // diferentes para a mesma coisa.
    const nomes = Object.values(PLANO_NA_TELA)
    for (const plan of ['free', 'pro', 'lixo']) {
      for (const temMax of [true, false]) {
        expect(nomes).toContain(rotuloDoPlano(plan, temMax))
      }
    }
  })
})
