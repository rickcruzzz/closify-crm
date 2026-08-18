import { describe, expect, it } from 'vitest'

import { extrairIpDoHeader } from './request-ip-parse'

describe('extrairIpDoHeader', () => {
  it('usa o primeiro IP da cadeia, que é o mais próximo do cliente', () => {
    expect(extrairIpDoHeader('203.0.113.5, 70.41.3.18, 150.172.238.178')).toBe('203.0.113.5')
  })

  it('aceita um único IP sem vírgula', () => {
    expect(extrairIpDoHeader('203.0.113.5')).toBe('203.0.113.5')
  })

  it('tira espaço em volta, o formato do header varia entre proxies', () => {
    expect(extrairIpDoHeader('  203.0.113.5  , 70.41.3.18')).toBe('203.0.113.5')
  })

  // Acontece em dev local (`next start` fora da Vercel), onde ninguém
  // preenche o header. Uma chave constante ali é inofensiva: nunca é o caso
  // em produção, onde a Vercel sempre escreve o header antes da função rodar.
  it('devolve "desconhecido" quando o header não existe', () => {
    expect(extrairIpDoHeader(null)).toBe('desconhecido')
  })

  it('devolve "desconhecido" para header vazio', () => {
    expect(extrairIpDoHeader('')).toBe('desconhecido')
  })
})
