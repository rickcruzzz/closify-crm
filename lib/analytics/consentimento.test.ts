import { describe, expect, it } from 'vitest'

import { interpretarConsentimento, podeRastrear } from './consentimento'

/**
 * O caso que motivou cada teste é o mesmo: rastrear alguém que não consentiu é
 * o defeito caro aqui — não quebra tela nenhuma, não aparece em log, e só é
 * descoberto por quem fiscaliza. Por isso a régua é "na dúvida, não rastreia".
 */
describe('consentimento de rastreamento', () => {
  it('só rastreia quem disse sim explicitamente', () => {
    expect(podeRastrear('aceito')).toBe(true)
  })

  it('não rastreia quem recusou', () => {
    expect(podeRastrear('recusado')).toBe(false)
  })

  // Quem nunca respondeu não é o mesmo que quem disse não: o primeiro ainda vê
  // o banner, o segundo não. Só a ausência de decisão devolve `null`.
  it('quem ainda não decidiu não é rastreado, e continua sem decisão', () => {
    expect(interpretarConsentimento(null)).toBeNull()
    expect(podeRastrear(null)).toBe(false)
  })

  // Valor corrompido, chave de uma versão anterior, ou alguém editando o
  // localStorage à mão. Herdar um "sim" que não foi dado para esta finalidade é
  // exatamente o que a LGPD chama de consentimento inválido.
  it('valor estranho vira "sem decisão", nunca aceite', () => {
    for (const lixo of ['sim', 'true', '1', 'ACEITO', '', 'aceito ', '{}']) {
      expect(interpretarConsentimento(lixo)).toBeNull()
      expect(podeRastrear(lixo)).toBe(false)
    }
  })
})
