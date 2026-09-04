import { describe, expect, it } from 'vitest'

import {
  DOMINIO_DE_PRODUCAO,
  PREFIXOS_PRIVADOS,
  ROTA_DE_CONVERSAO,
  ehAreaPrivada,
} from './superficie-publica'

describe('ehAreaPrivada', () => {
  it('bloqueia toda rota do CRM logado', () => {
    for (const prefixo of PREFIXOS_PRIVADOS) {
      expect(ehAreaPrivada(prefixo)).toBe(true)
    }
  })

  it('bloqueia também as rotas filhas', () => {
    expect(ehAreaPrivada('/leads/abc-123')).toBe(true)
    expect(ehAreaPrivada('/settings/billing')).toBe(true)
  })

  it('não bloqueia rota pública', () => {
    expect(ehAreaPrivada('/')).toBe(false)
    expect(ehAreaPrivada('/cadastro')).toBe(false)
    expect(ehAreaPrivada('/login')).toBe(false)
    expect(ehAreaPrivada('/quanto-custa-um-crm')).toBe(false)
    expect(ehAreaPrivada('/privacidade')).toBe(false)
  })

  it('não confunde prefixo com começo de outra palavra', () => {
    // `/leads` é prefixo de `/leadsource`; sem a checagem de `/` a rota pública
    // seria bloqueada por engano.
    expect(ehAreaPrivada('/leadsource')).toBe(false)
    expect(ehAreaPrivada('/hoje-mais-tarde')).toBe(false)
  })

  it('/hoje e /calendario continuam na lista', () => {
    // As duas FALTAVAM na lista original, achado em 21/08: o pixel carregava
    // nelas de verdade e produzia erro #418/#423 exclusivamente ali. O caso
    // fica travado porque a lista agora tem dois consumidores.
    expect(ehAreaPrivada('/hoje')).toBe(true)
    expect(ehAreaPrivada('/calendario')).toBe(true)
  })

  it('abre /bem-vindo APENAS para quem pede a exceção', () => {
    // A conversão do Google é do navegador e acontece ali. A do Meta é do
    // servidor, então o pixel não precisa da exceção e não a recebe.
    expect(ehAreaPrivada(ROTA_DE_CONVERSAO)).toBe(true)
    expect(ehAreaPrivada(ROTA_DE_CONVERSAO, { permitirConversao: true })).toBe(false)
  })

  it('a exceção NÃO vaza para o resto da área logada', () => {
    // O controle que separa "abri uma rota" de "abri a área logada". Sem ele,
    // um erro de escrita na condição poria a tag em /dashboard e /leads.
    expect(ehAreaPrivada('/dashboard', { permitirConversao: true })).toBe(true)
    expect(ehAreaPrivada('/leads', { permitirConversao: true })).toBe(true)
    expect(ehAreaPrivada('/onboarding', { permitirConversao: true })).toBe(true)
    // Nem para as filhas da própria rota de conversão.
    expect(ehAreaPrivada('/bem-vindo/algo', { permitirConversao: true })).toBe(true)
  })
})

describe('DOMINIO_DE_PRODUCAO', () => {
  it('é o domínio com www, que é o que o navegador de fato reporta', () => {
    // Sem o `www` a comparação falharia em produção e nenhum evento sairia —
    // e a versão sem `www` redireciona, então nunca é o `hostname` final.
    expect(DOMINIO_DE_PRODUCAO).toBe('www.velofunil.com.br')
  })
})
