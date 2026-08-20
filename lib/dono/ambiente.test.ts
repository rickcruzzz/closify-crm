import { describe, expect, it } from 'vitest'

import { ehAmbienteLocal } from './ambiente'

/**
 * Este é o teste de um gate de segurança, não de uma regra de negócio: se ele
 * falhar em silêncio, a base de clientes inteira (nome, e-mail, telefone,
 * valor de negócio de todo mundo) fica servida por HTTP. Por isso os casos
 * negativos são tão detalhados quanto o positivo.
 */
describe('ehAmbienteLocal', () => {
  describe('deixa passar', () => {
    it('localhost com porta, em desenvolvimento', () => {
      expect(ehAmbienteLocal('development', 'localhost:3000')).toBe(true)
    })

    it('outra porta serve igual — o dono roda em 3980 quando testa build', () => {
      expect(ehAmbienteLocal('development', 'localhost:3980')).toBe(true)
    })

    it('loopback IPv4', () => {
      expect(ehAmbienteLocal('development', '127.0.0.1:3000')).toBe(true)
    })

    // O `[::1]` vem entre colchetes por ser IPv6. Cortar o host no último ':'
    // para tirar a porta quebraria justamente este caso, daí o teste existir.
    it('loopback IPv6, que vem entre colchetes', () => {
      expect(ehAmbienteLocal('development', '[::1]:3000')).toBe(true)
    })

    it('sem porta nenhuma', () => {
      expect(ehAmbienteLocal('development', 'localhost')).toBe(true)
    })
  })

  describe('bloqueia', () => {
    // O caso que mais importa: é isto que impede a Central de existir no ar.
    it('produção, mesmo em localhost', () => {
      expect(ehAmbienteLocal('production', 'localhost:3000')).toBe(false)
    })

    it('o domínio real, em produção', () => {
      expect(ehAmbienteLocal('production', 'www.velofunil.com.br')).toBe(false)
    })

    // `next dev` escuta em TODAS as interfaces, não só na loopback. Sem esta
    // checagem, qualquer pessoa na mesma rede Wi-Fi abriria a Central pelo IP
    // da máquina enquanto o dono estivesse desenvolvendo.
    it('IP da máquina na rede local, mesmo em desenvolvimento', () => {
      expect(ehAmbienteLocal('development', '192.168.0.14:3000')).toBe(false)
      expect(ehAmbienteLocal('development', '10.0.0.7:3000')).toBe(false)
    })

    it('preview da Vercel', () => {
      expect(ehAmbienteLocal('production', 'closify-crm-dr3t.vercel.app')).toBe(false)
    })

    it('host ausente', () => {
      expect(ehAmbienteLocal('development', null)).toBe(false)
      expect(ehAmbienteLocal('development', undefined)).toBe(false)
      expect(ehAmbienteLocal('development', '')).toBe(false)
    })

    it('NODE_ENV ausente ou de teste', () => {
      expect(ehAmbienteLocal(undefined, 'localhost:3000')).toBe(false)
      expect(ehAmbienteLocal('test', 'localhost:3000')).toBe(false)
    })

    // Domínio que apenas COMEÇA com um host local não é host local. Sem o
    // separador obrigatório, `localhost.evil.com` passaria — é um ataque
    // conhecido contra checagem por prefixo.
    it('domínio que só começa com nome local', () => {
      expect(ehAmbienteLocal('development', 'localhost.evil.com')).toBe(false)
      expect(ehAmbienteLocal('development', '127.0.0.1.evil.com')).toBe(false)
    })
  })
})
