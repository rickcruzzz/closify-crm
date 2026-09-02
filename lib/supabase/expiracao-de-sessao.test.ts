import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Trava os dois prazos de sessão, lendo o arquivo de verdade.
 *
 * ## Por que ler o fonte, e não importar a constante
 *
 * Elas moram dentro do `if` do middleware, e extraí-las para exportar seria
 * mudar o código por causa do teste. Ler o arquivo custa nada e prova
 * exatamente o que precisa: que os números são os que foram decididos.
 *
 * ## Por que o número aparece literal aqui
 *
 * Escrever `7 * 24 * 60 * 60 * 1000` dos dois lados faria o teste concordar
 * com qualquer valor, inclusive um errado — ele compararia a expressão consigo
 * mesma. É a mesma razão pela qual o teste da fronteira de aviso de assinatura
 * usa literal, registrada em 25/08.
 */
const FONTE = readFileSync('lib/supabase/middleware.ts', 'utf8')

describe('prazos de expiração de sessão', () => {
  it('desloga depois de 7 dias sem abrir', () => {
    // Sete porque um CRM guarda dado pessoal de TERCEIRO, e o público daqui
    // usa computador compartilhado. Salesforce usa 2h, HubSpot 24h; Notion e
    // Linear ficam em meses porque guardam o trabalho da própria pessoa.
    expect(FONTE).toContain('const TIMEOUT_INATIVIDADE_MS = 7 * 24 * 60 * 60 * 1000')
  })

  it('mantém o teto absoluto de 30 dias desde o login', () => {
    // É o que limita o estrago de um cookie roubado: mesmo sem ninguém
    // perceber, a sessão morre sozinha.
    expect(FONTE).toContain('const EXPIRACAO_ABSOLUTA_MS = 30 * 24 * 60 * 60 * 1000')
  })

  it('a inatividade nunca é maior que o teto absoluto', () => {
    // Se um dia alguém inverter os dois, a inatividade deixaria de existir na
    // prática — o teto absoluto cortaria antes, sempre, e a trava mais
    // específica viraria código morto sem nada falhar.
    const inatividade = Number(
      /TIMEOUT_INATIVIDADE_MS = (\d+) \* 24/.exec(FONTE)?.[1] ?? '0',
    )
    const absoluta = Number(/EXPIRACAO_ABSOLUTA_MS = (\d+) \* 24/.exec(FONTE)?.[1] ?? '0')
    expect(inatividade).toBeGreaterThan(0)
    expect(inatividade).toBeLessThan(absoluta)
  })

  it('o cookie de atividade expira junto com a inatividade', () => {
    // Se o `maxAge` do cookie fosse maior, ele sobreviveria à janela que
    // deveria medir; se fosse menor, sumiria antes e toda passagem cairia no
    // `entrouEm`, que só muda em login novo — a sessão nunca expiraria por
    // inatividade.
    expect(FONTE).toContain('maxAge: Math.ceil(TIMEOUT_INATIVIDADE_MS / 1000)')
  })
})
