import { describe, expect, it, vi } from 'vitest'

import {
  converterComGtag,
  montarSendTo,
  podeConverter,
  podeDispararNoGtag,
} from './conversao-google'

const ACEITO = 'aceito'
const RECUSADO = 'recusado'
const SEND_TO = 'AW-123456789/AbC-dEfG'

describe('podeDispararNoGtag', () => {
  it('aceita função', () => {
    expect(podeDispararNoGtag(() => {})).toBe(true)
  })

  it('recusa o que um bloqueador deixa para trás', () => {
    // Extensão de bloqueio às vezes define a variável com um valor qualquer
    // para o script de terceiro não reclamar. Só função é chamável — `!!`
    // aceitaria os três casos abaixo e produziria `TypeError` na chamada.
    expect(podeDispararNoGtag({})).toBe(false)
    expect(podeDispararNoGtag(true)).toBe(false)
    expect(podeDispararNoGtag('gtag')).toBe(false)
    expect(podeDispararNoGtag(undefined)).toBe(false)
  })
})

describe('montarSendTo', () => {
  it('junta conta e ação', () => {
    expect(montarSendTo('AW-123456789', 'AbC-dEfG')).toBe(SEND_TO)
  })

  it('recusa com o ID e SEM o rótulo, a falha mais silenciosa daqui', () => {
    // Sem o rótulo a tag carrega, a chamada sai e o Google não sabe qual
    // conversão contar: relatório zerado com tudo parecendo certo na tela.
    expect(montarSendTo('AW-123456789', null)).toBeNull()
  })

  it('recusa com o rótulo e sem o ID', () => {
    expect(montarSendTo(null, 'AbC-dEfG')).toBeNull()
  })
})

/**
 * O defeito que estes casos travam é uma AUSÊNCIA: nada falhava, nenhum teste
 * quebrava, e a conversão saía de quem tinha clicado "Recusar". Só um caso que
 * exercita a recusa explicitamente o pega — foi assim que a mesma lacuna
 * apareceu na Conversions API da Meta em 02/09.
 */
describe('podeConverter', () => {
  const gtag = () => {}

  it('deixa passar quem aceitou e ainda não foi contado', () => {
    expect(podeConverter(ACEITO, false, gtag)).toBe(true)
  })

  it('recusa quem clicou em Recusar', () => {
    expect(podeConverter(RECUSADO, false, gtag)).toBe(false)
  })

  it('recusa quem NÃO DECIDIU, ausência nunca é consentimento', () => {
    expect(podeConverter(null, false, gtag)).toBe(false)
    expect(podeConverter('', false, gtag)).toBe(false)
    // Chave de outra versão, ou storage editado à mão.
    expect(podeConverter('sim', false, gtag)).toBe(false)
  })

  it('recusa a segunda vez da mesma conta', () => {
    expect(podeConverter(ACEITO, true, gtag)).toBe(false)
  })

  it('recusa sem gtag, que é o estado normal em quatro casos', () => {
    expect(podeConverter(ACEITO, false, undefined)).toBe(false)
  })
})

describe('converterComGtag', () => {
  it('dispara com o send_to montado', () => {
    const gtag = vi.fn()
    expect(converterComGtag(gtag, SEND_TO, ACEITO, false)).toBe(true)
    expect(gtag).toHaveBeenCalledWith('event', 'conversion', { send_to: SEND_TO })
  })

  it('NÃO dispara para quem recusou, e o gtag nem é tocado', () => {
    // O controle que separa "bloqueou" de "bloqueou tarde demais": se o `gtag`
    // fosse chamado e só depois a decisão avaliada, o Google já teria recebido.
    const gtag = vi.fn()
    expect(converterComGtag(gtag, SEND_TO, RECUSADO, false)).toBe(false)
    expect(gtag).not.toHaveBeenCalled()
  })

  it('NÃO dispara duas vezes para a mesma conta', () => {
    // `/bem-vindo` é reapresentada a quem volta com o onboarding pela metade
    // (app/(dashboard)/layout.tsx:74). Sem esta cerca o custo por conversão
    // apareceria menor do que é.
    const gtag = vi.fn()
    expect(converterComGtag(gtag, SEND_TO, ACEITO, true)).toBe(false)
    expect(gtag).not.toHaveBeenCalled()
  })

  it('NÃO dispara sem send_to, mesmo com tudo o mais em ordem', () => {
    const gtag = vi.fn()
    expect(converterComGtag(gtag, null, ACEITO, false)).toBe(false)
    expect(gtag).not.toHaveBeenCalled()
  })

  it('engole exceção do gtag em vez de derrubar a página', () => {
    // Código de terceiro que lança durante o commit do React sobe até
    // `app/global-error.tsx` e pinta a tela de preto. Já aconteceu em 24/08.
    const gtag = vi.fn(() => {
      throw new Error('bloqueador de anúncio')
    })
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => converterComGtag(gtag, SEND_TO, ACEITO, false)).not.toThrow()
    expect(converterComGtag(gtag, SEND_TO, ACEITO, false)).toBe(false)

    consola.mockRestore()
  })
})
