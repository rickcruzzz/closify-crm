import { describe, expect, it } from 'vitest'

import { divisaoSegura, podeImportarConversao, reaisDeMicros } from './google-ads'

describe('reaisDeMicros', () => {
  it('converte micros, que e como o Google devolve TODO dinheiro', () => {
    // Medido em 08/09 na conta real: `costMicros: "4770000"` = R$ 4,77.
    expect(reaisDeMicros('4770000')).toBe(4.77)
    expect(reaisDeMicros('25000000')).toBe(25)
  })

  it('aceita STRING, que e o que o JSON do Google manda', () => {
    // O Google serializa micros como string para nao perder precisao em
    // valores grandes. Tratar so `number` daria 0 em toda leitura real — e
    // zero num campo de dinheiro parece medicao, nao defeito.
    expect(reaisDeMicros('4770000')).toBe(reaisDeMicros(4770000))
  })

  it('ausente ou ilegivel vira 0, nunca NaN', () => {
    // `NaN` numa soma contamina o total inteiro e a tela mostra "R$ NaN".
    for (const v of [null, undefined, '', 'abc', {}, []]) expect(reaisDeMicros(v)).toBe(0)
  })

  it('NAO esquece a divisao: o erro daria um numero mil vezes maior', () => {
    // Esquecer `/ 1_000_000` nao produz erro — produz R$ 4.770.000,00 com cara
    // de medicao. E o tipo de defeito que passa por revisao.
    expect(reaisDeMicros('4770000')).toBeLessThan(10)
  })
})

describe('divisaoSegura', () => {
  it('devolve null quando nao ha denominador, e nao Infinity', () => {
    // Palavra com 0 impressoes nao tem "CTR zero" — nao tem CTR. A tela precisa
    // saber a diferenca para escrever "—" em vez de "0%".
    expect(divisaoSegura(0, 0)).toBeNull()
    expect(divisaoSegura(2, 0)).toBeNull()
  })

  it('calcula quando da', () => {
    // 2 cliques em 16 impressoes: o CTR real de "quanto custa um crm" em 08/09.
    expect(divisaoSegura(2, 16)).toBeCloseTo(0.125)
    expect(divisaoSegura(4.77, 2)).toBeCloseTo(2.385)
  })

  it('entrada quebrada nao vira NaN silencioso', () => {
    expect(divisaoSegura(Number.NaN, 10)).toBeNull()
    expect(divisaoSegura(10, Number.NaN)).toBeNull()
  })
})

describe('podeImportarConversao', () => {
  it('WEBPAGE nao serve: e o que a conta tem hoje, e ele RECUSA upload', () => {
    // Medido em 08/09: a unica acao e "Inscricao", tipo WEBPAGE. E por isso que
    // o elo pagamento -> Google Ads nao existe — nao e falta de token.
    expect(podeImportarConversao([{ tipo: 'WEBPAGE', status: 'ENABLED' }])).toBe(false)
  })

  it('UPLOAD_CLICKS habilitado e o que destrava a conversao offline', () => {
    expect(podeImportarConversao([{ tipo: 'UPLOAD_CLICKS', status: 'ENABLED' }])).toBe(true)
  })

  it('UPLOAD_CLICKS PAUSADO nao conta: existir nao e o mesmo que aceitar', () => {
    // O controle que separa "criei a acao" de "a acao recebe". Sem ele, a tela
    // diria que da para importar e o upload seria recusado pelo Google.
    expect(podeImportarConversao([{ tipo: 'UPLOAD_CLICKS', status: 'REMOVED' }])).toBe(false)
    expect(podeImportarConversao([{ tipo: 'UPLOAD_CLICKS', status: 'PAUSED' }])).toBe(false)
  })

  it('lista vazia e false, e nao um erro', () => {
    expect(podeImportarConversao([])).toBe(false)
  })
})
