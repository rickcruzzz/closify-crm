import { describe, expect, it } from 'vitest'

import { ehCookieDeRastreamento,
  dominiosParaApagar,
  linhasQueApagam,
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

/**
 * Achado medindo em produção em 05/09: recusar o banner impedia rastreamento
 * NOVO — a tag não carrega, provado nos dois sentidos — e deixava `_fbp`,
 * `_gcl_au` e `_gcl_aw` vivos no navegador.
 *
 * Não era defeito da tag do Google: o `_fbp` se comportava assim desde que o
 * banner nasceu, em 23/08. Mesma família do buraco de 02/09.
 */
describe('ehCookieDeRastreamento', () => {
  it('pega os que o Google e a Meta gravam', () => {
    for (const nome of ['_gcl_au', '_gcl_aw', '_gcl_dc', '_gcl_gb', '_fbp', '_fbc']) {
      expect(ehCookieDeRastreamento(nome), nome).toBe(true)
    }
  })

  it('pega variante de `_gcl_` que ainda não existe', () => {
    // Por PREFIXO e não por lista fechada: o Google acrescenta variantes
    // conforme o produto, e uma lista escrita à mão envelheceria em silêncio —
    // o cookie novo ficaria para trás sem nada falhar.
    expect(ehCookieDeRastreamento('_gcl_inventado_em_2027')).toBe(true)
  })

  it('NÃO toca no que o produto precisa', () => {
    // O controle que separa "apaguei o rastreamento" de "desloguei a pessoa".
    // O cookie de sessão do Supabase e o próprio consentimento têm que ficar.
    for (const nome of [
      'sb-tmyeunithjqkbwvezyyn-auth-token',
      COOKIE_CONSENTIMENTO,
      'vf_utm',
      'vf_convite',
      '__Host-next-auth',
    ]) {
      expect(ehCookieDeRastreamento(nome), nome).toBe(false)
    }
  })
})

describe('dominiosParaApagar', () => {
  // ## O escopo é o que fez a primeira tentativa de prova falhar
  //
  // Cookie só é apagado por uma escrita que case com o domínio com que foi
  // criado. `_fbp` nasce no host; `_gcl_au` nasce no domínio registrável, para
  // valer em qualquer subdomínio. Apagar só com `Path=/` não tocou nos `_gcl_*`,
  // e eu quase registrei "não dá para apagar" quando faltava era o escopo.
  it('cobre o host e o domínio registrável, com e sem ponto', () => {
    const escopos = dominiosParaApagar('www.velofunil.com.br')

    expect(escopos).toContain(null) // sem atributo `domain`
    expect(escopos).toContain('www.velofunil.com.br')
    expect(escopos).toContain('.velofunil.com.br')
    expect(escopos).toContain('velofunil.com.br')
  })

  it('funciona em localhost, que tem um rótulo só', () => {
    // Sem isto a função estouraria ou devolveria lista vazia no ambiente de
    // desenvolvimento, e o caminho nunca teria rodado antes de produção.
    expect(dominiosParaApagar('localhost')).toEqual([null])
  })
})

describe('linhasQueApagam', () => {
  it('expira no passado, em todos os escopos', () => {
    const linhas = linhasQueApagam('_gcl_au', 'www.velofunil.com.br')

    for (const linha of linhas) {
      expect(linha).toContain('_gcl_au=;')
      expect(linha).toContain('Path=/')
      expect(linha).toContain('Expires=Thu, 01 Jan 1970')
    }
    // Uma sem `Domain` (para o cookie criado no próprio host) e as demais com.
    expect(linhas.filter((l) => !l.includes('Domain='))).toHaveLength(1)
    expect(linhas.some((l) => l.includes('Domain=.velofunil.com.br'))).toBe(true)
  })
})
