import { describe, expect, it } from 'vitest'

import {
  COOKIE_CONSENTIMENTO,
  interpretarConsentimento,
  lerConsentimentoDoCookie,
  podeRastrear,
} from './consentimento'

/**
 * Trava que o consentimento vale para o SERVIDOR, não só para o navegador.
 *
 * ## O defeito que estes casos protegem
 *
 * O pixel do navegador sempre respeitou o banner, com duas cercas. A
 * Conversions API — que envia e-mail, telefone, nome, cidade, estado, CEP e
 * `external_id` — não consultava nada: a decisão vivia em `localStorage`, e o
 * servidor não lê `localStorage`.
 *
 * Quem clicava "Recusar" e se cadastrava tinha tudo isso enviado à Meta. Nada
 * falhava, nenhum teste quebrava, e a Política de Privacidade descrevia outra
 * coisa. Só um teste que afirma a RECUSA pega esse tipo de defeito.
 */
describe('lerConsentimentoDoCookie', () => {
  it('lê a decisão de aceite', () => {
    expect(lerConsentimentoDoCookie(`${COOKIE_CONSENTIMENTO}=aceito`)).toBe('aceito')
  })

  it('lê a recusa, que é o caso que importa', () => {
    expect(lerConsentimentoDoCookie(`${COOKIE_CONSENTIMENTO}=recusado`)).toBe('recusado')
  })

  it('acha o cookie no meio de outros', () => {
    // Cenário real: o navegador manda a jarra inteira, com `_fbp`, cookie de
    // sessão do Supabase e o que mais houver.
    const jarra = `sb-access-token=abc; ${COOKIE_CONSENTIMENTO}=aceito; _fbp=fb.1.123.456`
    expect(lerConsentimentoDoCookie(jarra)).toBe('aceito')
  })

  it('devolve null quando o cookie não existe', () => {
    expect(lerConsentimentoDoCookie('_fbp=fb.1.123.456')).toBeNull()
  })

  it('devolve null para jarra vazia, undefined e null', () => {
    // Cookie bloqueado pelo navegador cai aqui, e o resultado tem de ser o
    // mesmo de "não decidiu": não rastrear.
    expect(lerConsentimentoDoCookie('')).toBeNull()
    expect(lerConsentimentoDoCookie(undefined)).toBeNull()
    expect(lerConsentimentoDoCookie(null)).toBeNull()
  })

  it('não confunde um cookie de nome parecido', () => {
    // `vf_consentimento_v1_outro` não é o nosso, e um `includes` ingênuo
    // casaria com ele.
    expect(lerConsentimentoDoCookie(`${COOKIE_CONSENTIMENTO}_outro=aceito`)).toBeNull()
  })

  it('trata valor estranho como não decidido', () => {
    // Alguém editando o cookie à mão, ou versão antiga da chave.
    expect(lerConsentimentoDoCookie(`${COOKIE_CONSENTIMENTO}=talvez`)).toBeNull()
    expect(lerConsentimentoDoCookie(`${COOKIE_CONSENTIMENTO}=true`)).toBeNull()
  })
})

describe('a regra que a CAPI aplica', () => {
  it('só envia com aceite EXPLÍCITO', () => {
    // As três formas de "não sei": ausência, recusa e valor estranho. Nenhuma
    // pode liberar o envio — ausência de decisão não é consentimento.
    expect(podeRastrear('aceito')).toBe(true)
    expect(podeRastrear('recusado')).toBe(false)
    expect(podeRastrear(null)).toBe(false)
    expect(podeRastrear('qualquer coisa')).toBe(false)
  })

  it('o cookie e o localStorage falam a mesma língua', () => {
    // As duas fontes usam `interpretarConsentimento`. Se divergirem, o pixel
    // e a CAPI passam a discordar sobre a mesma escolha da pessoa.
    for (const valor of ['aceito', 'recusado', 'lixo', '']) {
      expect(lerConsentimentoDoCookie(`${COOKIE_CONSENTIMENTO}=${valor}`)).toBe(
        interpretarConsentimento(valor),
      )
    }
  })
})
