import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  podeDispararNoPixel,
  podeRastrearEsteEvento,
  dispararComFbq,
} from '@/lib/analytics/pixel-evento'

/**
 * O que estes casos protegem, e por quê.
 *
 * O pixel deste projeto se recusa a carregar por quatro razões
 * (`components/analytics/meta-pixel.tsx`): consentimento recusado, domínio que
 * não é produção, rota da área logada, ID inválido. Em qualquer uma delas
 * `window.fbq` não existe — e chamá-lo levanta `ReferenceError` dentro do
 * layout RAIZ, que é o caminho exato da tela preta de 24/08: a exceção sobe
 * até `app/global-error.tsx` e o site inteiro fica `#0a0a0a`.
 *
 * Ou seja: o caso que precisa estar travado por teste não é o de disparar, é o
 * de NÃO disparar sem derrubar nada.
 */
describe('podeDispararNoPixel', () => {
  it('aceita função — é o único valor chamável', () => {
    expect(podeDispararNoPixel(() => {})).toBe(true)
  })

  it('recusa `undefined`, que é o estado normal de quem recusou os cookies', () => {
    expect(podeDispararNoPixel(undefined)).toBe(false)
  })

  // Bloqueador de anúncio e extensão de privacidade não apagam `window.fbq`:
  // costumam deixar no lugar um objeto vazio ou um valor verdadeiro, para que
  // o código do site não perceba. Um `!!fbq` passaria nos três abaixo e
  // quebraria na chamada.
  it.each([
    ['objeto vazio deixado por bloqueador', {}],
    ['`true` de extensão', true],
    ['string', 'fbq'],
    ['null', null],
  ])('recusa %s', (_rotulo, valor) => {
    expect(podeDispararNoPixel(valor)).toBe(false)
  })
})

/**
 * Este bloco existe por um defeito que o CONTROLE NEGATIVO do roteiro achou em
 * 30/08, e que o teste do caminho feliz jamais pegaria.
 *
 * A cerca original era só `typeof fbq === 'function'`. Com um `fbq` qualquer
 * definido em `window`, o evento saía **sem consentimento** — a proteção real
 * vinha de outro componente (`meta-pixel.tsx` não injeta o script antes do
 * aceite), não deste caminho. Efeito colateral de terceiro não é garantia:
 * uma extensão, outro script ou uma refatoração do pixel bastariam para o
 * consentimento deixar de valer, sem nada falhar.
 */
describe('podeRastrearEsteEvento', () => {
  const fbq = () => {}

  it('exige consentimento explícito, mesmo com fbq presente', () => {
    expect(podeRastrearEsteEvento('aceito', fbq)).toBe(true)
    expect(podeRastrearEsteEvento('recusado', fbq)).toBe(false)
  })

  // Quem ainda não respondeu o banner não consentiu — a ANPD pede bloqueio
  // ATÉ a escolha, não depois dela.
  it('trata "ainda não decidiu" como não', () => {
    expect(podeRastrearEsteEvento(null, fbq)).toBe(false)
  })

  it('trata valor estranho no storage como não', () => {
    expect(podeRastrearEsteEvento('sim', fbq)).toBe(false)
  })

  it('exige as DUAS condições, não uma', () => {
    expect(podeRastrearEsteEvento('aceito', undefined)).toBe(false)
  })
})

describe('dispararComFbq', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dispara com o comando e o nome que a Meta espera', () => {
    const fbq = vi.fn()

    dispararComFbq(fbq, 'ViewContent', 'aceito')

    expect(fbq).toHaveBeenCalledWith('track', 'ViewContent')
  })

  it('NÃO dispara sem consentimento, mesmo com fbq chamável', () => {
    const fbq = vi.fn()

    dispararComFbq(fbq, 'ViewContent', 'recusado')
    dispararComFbq(fbq, 'ViewContent', null)

    expect(fbq).not.toHaveBeenCalled()
  })

  it('não levanta quando o pixel não carregou', () => {
    expect(() => dispararComFbq(undefined, 'ViewContent', 'aceito')).not.toThrow()
  })

  it('não tenta chamar o que um bloqueador deixou no lugar', () => {
    expect(() => dispararComFbq({}, 'ViewContent', 'aceito')).not.toThrow()
  })

  /**
   * `fbq` é código de terceiro: ele enfileira e executa o script da Meta. Se
   * ele lançar, o erro não pode subir — é a mesma cerca de
   * `components/analytics/isolar-analytics.tsx`, e a regra de 24/08: medição
   * quebrada custa o dado, nunca a visita.
   */
  it('engole exceção vinda de dentro do fbq', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      dispararComFbq(
        () => {
          throw new Error('quebrou dentro da Meta')
        },
        'ViewContent',
        'aceito',
      ),
    ).not.toThrow()
  })
})
