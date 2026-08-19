import { describe, expect, it } from 'vitest'

import { mensagemPorContagemDeConexoes } from './mensagem-bloqueio-pro'

describe('mensagemPorContagemDeConexoes', () => {
  // O defeito real que motivou esta função (18/08): workspace que NUNCA teve
  // Pro via "Seu Pro venceu, reative", frase que implica ter pagado antes.
  it('zero conexão (nunca foi Pro) pede upgrade, não reativação', () => {
    expect(mensagemPorContagemDeConexoes(0)).toBe(
      'Integrações são um recurso Pro. Faça upgrade para conectar.',
    )
  })

  it('nenhuma linha ainda (count nulo) trata como nunca foi Pro', () => {
    expect(mensagemPorContagemDeConexoes(null)).toBe(
      'Integrações são um recurso Pro. Faça upgrade para conectar.',
    )
  })

  it('alguma conexão (já foi Pro) pede reativação, não upgrade', () => {
    expect(mensagemPorContagemDeConexoes(1)).toBe(
      'Seu Pro venceu. Reative o plano para continuar usando integrações.',
    )
  })

  it('múltiplas conexões (Google Calendar e Gmail, por exemplo) continua reativação', () => {
    expect(mensagemPorContagemDeConexoes(2)).toBe(
      'Seu Pro venceu. Reative o plano para continuar usando integrações.',
    )
  })
})
