import { describe, expect, it } from 'vitest'

import { ehRuidoDeDesenvolvimento } from './ruido'

/**
 * Cada caso aqui é uma URL que de fato apareceu em `error_logs`, ou o
 * contra-exemplo que impede a regra de ir longe demais.
 */
describe('ruído de desenvolvimento em error_logs', () => {
  it('recusa as URLs de localhost que de fato encheram a tabela', () => {
    // Estas quatro portas estão gravadas em produção, de servidores que o
    // agente subiu durante os testes. São 67 dos 73 registros.
    for (const url of [
      'http://localhost:3000/',
      'http://localhost:3979/',
      'http://localhost:3984/',
      'http://localhost:3985/onboarding',
      'http://127.0.0.1:3000/kanban',
    ]) {
      expect(ehRuidoDeDesenvolvimento(url), url).toBe(true)
    }
  })

  it('recusa o IP da máquina na rede local', () => {
    // `next dev` escuta em todas as interfaces, então o mesmo servidor é
    // alcançável pelo IP da máquina — foi por isso que a Central do Dono
    // precisou de gate de host além do `NODE_ENV`.
    expect(ehRuidoDeDesenvolvimento('http://192.168.0.14:3000/')).toBe(true)
    expect(ehRuidoDeDesenvolvimento('http://10.0.0.5:3000/')).toBe(true)
    expect(ehRuidoDeDesenvolvimento('http://172.20.1.9:3000/')).toBe(true)
    expect(ehRuidoDeDesenvolvimento('http://meu-mac.local:3000/')).toBe(true)
  })

  it('GRAVA o que vem de produção', () => {
    // O caso que a tabela existe para capturar.
    for (const url of [
      'https://www.velofunil.com.br/kanban',
      'https://www.velofunil.com.br/',
      'https://velofunil.com.br/leads/123',
      'https://closify-crm-dr3t-abc.vercel.app/dashboard',
    ]) {
      expect(ehRuidoDeDesenvolvimento(url), url).toBe(false)
    }
  })

  it('na dúvida, grava', () => {
    // URL ausente ou ilegível não prova origem. Erro de cliente perdido é
    // pior que uma linha de ruído — e a rota tem rate limit de 30/h por IP.
    expect(ehRuidoDeDesenvolvimento(undefined)).toBe(false)
    expect(ehRuidoDeDesenvolvimento(null)).toBe(false)
    expect(ehRuidoDeDesenvolvimento('')).toBe(false)
    expect(ehRuidoDeDesenvolvimento('nao é uma url')).toBe(false)
  })

  it('não confunde domínio que apenas CONTÉM o nome de um host local', () => {
    // O gate da Central do Dono foi provado contra `localhost.evil.com`
    // justamente porque comparar por substring deixaria passar. Aqui o efeito
    // é o inverso — descartar erro de produção —, e o teste trava os dois
    // sentidos.
    expect(ehRuidoDeDesenvolvimento('https://localhost.evil.com/kanban')).toBe(false)
    expect(ehRuidoDeDesenvolvimento('https://naolocalhost.com.br/')).toBe(false)
    expect(ehRuidoDeDesenvolvimento('https://meu-localdomain.com/')).toBe(false)
  })
})
